from fastapi import APIRouter, HTTPException, Query, Request
import json
import re
from datetime import datetime
from db import query, execute

router = APIRouter()

_LEAD_LIST_COLS = """
    id, customer, confirm_num, reservation_id, knum, email, phone,
    source_email, source_phone, source_status, status, archived,
    enrichment_complete, branch, bm_name, days_open, mismatch,
    mismatch_reason, gm_directive, insurance_company, body_shop,
    time_to_first_contact, first_contact_by, time_to_cancel,
    hles_reason, last_activity, enrichment, init_dt_final, week_of,
    contact_range, last_upload_id, cdp_name, htz_region, set_state,
    zone, area_mgr, general_mgr, rent_loc, created_at
""".strip()


def _normalize(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", str(s).strip().lower())


def _branches_for_gm(gm_name: str) -> list[str]:
    """Resolve GM name → list of branches from org_mapping + leads."""
    nm = _normalize(gm_name)
    if not nm:
        return []
    org_rows = query("SELECT branch, gm FROM org_mapping")
    from_org = {r["branch"] for r in org_rows if _normalize(r.get("gm")) == nm}
    if from_org:
        return list(from_org)
    lead_branches = query(
        "SELECT DISTINCT branch FROM leads WHERE archived = false AND lower(general_mgr) LIKE %s",
        (f"%{nm}%",),
    )
    return [r["branch"] for r in lead_branches]


def _user_from_jwt(request: Request) -> dict | None:
    """Extract user info from JWT — tries Authorization, X-Leo-Token, and _token query param."""
    import jwt as _jwt
    import os
    token = None
    source = None

    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        source = "Authorization"

    if not token:
        token = request.headers.get("x-leo-token")
        if token:
            source = "X-Leo-Token"

    if not token:
        token = request.query_params.get("_token")
        if token:
            source = "query-param"

    if not token:
        print("[leads-api] no JWT token found in any header or query param", flush=True)
        return None

    secret = os.getenv("LEO_JWT_SECRET", "leo-mvp-secret-change-in-prod")
    try:
        payload = _jwt.decode(token, secret, algorithms=["HS256"])
        print(f"[leads-api] JWT decoded via {source}: role={payload.get('role')}", flush=True)
        return payload
    except Exception as e:
        print(f"[leads-api] JWT decode failed ({source}): {e}", flush=True)
        return None


@router.get("/leads")
async def get_leads(
    request: Request,
    branches: str = Query(None),
    branch: str = Query(None),
    gm_name: str = Query(None),
    status: str = Query(None),
    bm_name: str = Query(None),
    insurance: str = Query(None),
    search: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    paged: bool = Query(False),
):
    import time as _time
    t0 = _time.monotonic()

    branch_list = None
    if branches:
        branch_list = [b.strip() for b in branches.split(",") if b.strip()]
    elif branch:
        branch_list = [branch]
    elif gm_name:
        branch_list = _branches_for_gm(gm_name)
        print(f"[leads-api] resolved gm_name '{gm_name}' -> {len(branch_list)} branches", flush=True)

    # Auto-filter by JWT user context if no explicit filter
    if not branch_list:
        jwt_user = _user_from_jwt(request)
        if jwt_user:
            role = jwt_user.get("role")
            if role == "bm":
                user_rows = query(
                    "SELECT branch FROM auth_users WHERE id = %s::uuid",
                    (jwt_user.get("sub"),),
                )
                if user_rows and user_rows[0].get("branch"):
                    branch_list = [user_rows[0]["branch"]]
                    print(f"[leads-api] JWT bm -> branch={branch_list[0]}", flush=True)
            elif role == "gm":
                user_rows = query(
                    "SELECT display_name FROM auth_users WHERE id = %s::uuid",
                    (jwt_user.get("sub"),),
                )
                if user_rows and user_rows[0].get("display_name"):
                    branch_list = _branches_for_gm(user_rows[0]["display_name"])
                    print(f"[leads-api] JWT gm '{user_rows[0]['display_name']}' -> {len(branch_list)} branches", flush=True)

    where = ["archived = false"]
    params: list = []

    if branch_list:
        placeholders = ",".join(["%s"] * len(branch_list))
        where.append(f"branch IN ({placeholders})")
        params.extend(branch_list)

    if status and status != "All":
        where.append("status = %s")
        params.append(status)

    if bm_name and bm_name != "All":
        where.append("bm_name = %s")
        params.append(bm_name)

    if insurance and insurance != "All":
        where.append("insurance_company = %s")
        params.append(insurance)

    if search:
        like = f"%{search.strip()}%"
        where.append("(customer ILIKE %s OR reservation_id ILIKE %s OR confirm_num ILIKE %s)")
        params.extend([like, like, like])

    if start_date:
        where.append("COALESCE(init_dt_final, week_of) >= %s::date")
        params.append(start_date)
    if end_date:
        where.append("COALESCE(init_dt_final, week_of) <= %s::date")
        params.append(end_date)

    where_sql = " AND ".join(where)

    if paged:
        count_rows = query(f"SELECT COUNT(*)::int AS total FROM leads WHERE {where_sql}", tuple(params))
        total = count_rows[0]["total"] if count_rows else 0
        paged_params = [*params, limit, offset]
        rows = query(
            f"SELECT {_LEAD_LIST_COLS} FROM leads"
            f" WHERE {where_sql}"
            f" ORDER BY created_at DESC"
            f" LIMIT %s OFFSET %s",
            tuple(paged_params),
        )
        t1 = _time.monotonic()
        print(f"[leads-api] paged rows={len(rows)}/{total}, offset={offset}, limit={limit}, query={t1-t0:.2f}s", flush=True)
        return {
            "items": rows,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_next": (offset + limit) < total,
        }

    rows = query(
        f"SELECT {_LEAD_LIST_COLS} FROM leads"
        f" WHERE {where_sql}"
        f" ORDER BY created_at DESC",
        tuple(params),
    )
    t1 = _time.monotonic()
    print(f"[leads-api] rows={len(rows)}, query={t1-t0:.2f}s", flush=True)
    return rows

@router.get("/leads/{lead_id}")
async def get_lead(lead_id: int):
    rows = query("SELECT * FROM leads WHERE id = %s", (lead_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Lead not found")
    return rows[0]

@router.get("/leads/{lead_id}/activities")
async def get_lead_activities(lead_id: int):
    return query(
        "SELECT * FROM lead_activities WHERE lead_id = %s ORDER BY created_at DESC",
        (lead_id,)
    )

@router.put("/leads/{lead_id}/enrichment")
async def update_enrichment(lead_id: int, body: dict):
    # Append new log entry to existing enrichment_log
    existing = query("SELECT enrichment_log FROM leads WHERE id = %s", (lead_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")

    current_log = existing[0]["enrichment_log"] or []
    log_entry = body.get("enrichment_log_entry")
    if log_entry:
        current_log.append(log_entry)

    execute(
        """UPDATE leads SET
            enrichment = %s::jsonb,
            enrichment_log = %s::jsonb,
            enrichment_complete = %s,
            status = COALESCE(%s, status),
            updated_at = now()
        WHERE id = %s""",
        (
            json.dumps(body.get("enrichment")),
            json.dumps(current_log),
            body.get("enrichment_complete", False),
            body.get("status"),
            lead_id,
        )
    )
    rows = query("SELECT * FROM leads WHERE id = %s", (lead_id,))
    return rows[0] if rows else {"ok": True}

@router.put("/leads/{lead_id}/directive")
async def update_directive(lead_id: int, body: dict):
    execute(
        "UPDATE leads SET gm_directive = %s, updated_at = now() WHERE id = %s",
        (body.get("gm_directive"), lead_id)
    )
    rows = query("SELECT * FROM leads WHERE id = %s", (lead_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Lead not found")
    directive_text = body.get("gm_directive")
    if directive_text:
        existing = query(
            "SELECT id, notes_log FROM tasks WHERE lead_id = %s AND source = 'gm_assigned' AND status IN ('Open', 'In Progress') ORDER BY created_at DESC LIMIT 1",
            (lead_id,),
        )
        if existing:
            task = existing[0]
            log = json.loads(task.get("notes_log") or "[]") if isinstance(task.get("notes_log"), str) else (task.get("notes_log") or [])
            log.append({
                "text": directive_text,
                "by": body.get("created_by_name", "GM"),
                "at": datetime.utcnow().isoformat(),
            })
            execute(
                "UPDATE tasks SET notes = %s, notes_log = %s::jsonb, updated_at = now() WHERE id = %s",
                (directive_text, json.dumps(log), task["id"]),
            )
        else:
            lead = rows[0]
            customer = lead.get("customer", "Unknown")
            execute(
                """INSERT INTO tasks (title, description, lead_id, assigned_to_name, created_by_name, source, priority, status)
                VALUES (%s, %s, %s, %s, %s, 'gm_assigned', 'Normal', 'Open')""",
                (
                    f"GM Directive: {customer}",
                    directive_text,
                    lead_id,
                    lead.get("bm_name", ""),
                    body.get("created_by_name", "GM"),
                ),
            )
    return rows[0]

@router.put("/leads/{lead_id}/contact")
async def update_contact(lead_id: int, body: dict):
    existing = query("SELECT enrichment_log FROM leads WHERE id = %s", (lead_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")

    current_log = existing[0]["enrichment_log"] or []
    log_entry = body.get("enrichment_log_entry")
    if log_entry:
        current_log.append(log_entry)

    execute(
        """UPDATE leads SET
            email = COALESCE(%s, email),
            phone = COALESCE(%s, phone),
            enrichment_log = %s::jsonb,
            updated_at = now()
        WHERE id = %s""",
        (body.get("email"), body.get("phone"), json.dumps(current_log), lead_id)
    )
    rows = query("SELECT * FROM leads WHERE id = %s", (lead_id,))
    return rows[0] if rows else {"ok": True}

@router.put("/leads/{lead_id}/review")
async def mark_lead_reviewed(lead_id: int):
    execute(
        "UPDATE leads SET status = 'Reviewed', archived = true, updated_at = now() WHERE id = %s",
        (lead_id,)
    )
    rows = query("SELECT * FROM leads WHERE id = %s", (lead_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Lead not found")
    return rows[0]

@router.put("/leads/{lead_id}/archive")
async def archive_lead(lead_id: int):
    execute(
        "UPDATE leads SET archived = true, updated_at = now() WHERE id = %s",
        (lead_id,)
    )
    return {"ok": True}
