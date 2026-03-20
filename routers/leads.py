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
        normalized = [re.sub(r"\s+", " ", b.strip()) for b in branch_list]
        placeholders = ",".join(["%s"] * len(normalized))
        where.append(f"regexp_replace(branch, '\\s+', ' ', 'g') IN ({placeholders})")
        params.extend(normalized)

    if status and status != "All":
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        if len(statuses) == 1:
            where.append("status = %s")
            params.append(statuses[0])
        elif statuses:
            placeholders_s = ",".join(["%s"] * len(statuses))
            where.append(f"status IN ({placeholders_s})")
            params.extend(statuses)

    if bm_name and bm_name != "All":
        where.append("regexp_replace(lower(bm_name), '\\s+', ' ', 'g') = regexp_replace(lower(%s), '\\s+', ' ', 'g')")
        params.append(bm_name)

    if insurance and insurance != "All":
        where.append("insurance_company = %s")
        params.append(insurance)

    if search:
        like = f"%{search.strip()}%"
        where.append("(customer ILIKE %s OR reservation_id ILIKE %s OR confirm_num ILIKE %s)")
        params.extend([like, like, like])

    if request.query_params.get("enrichment_complete") is not None:
        ec_val = request.query_params.get("enrichment_complete", "").lower()
        if ec_val in ("true", "1"):
            where.append("enrichment_complete = true")
        elif ec_val in ("false", "0"):
            where.append("enrichment_complete = false")

    if request.query_params.get("has_directive") is not None:
        hd_val = request.query_params.get("has_directive", "").lower()
        if hd_val in ("true", "1"):
            where.append("gm_directive IS NOT NULL AND gm_directive != ''")
        elif hd_val in ("false", "0"):
            where.append("(gm_directive IS NULL OR gm_directive = '')")

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
            f" ORDER BY COALESCE(init_dt_final, week_of) DESC NULLS LAST, created_at DESC"
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

    hard_cap = 500
    rows = query(
        f"SELECT {_LEAD_LIST_COLS} FROM leads"
        f" WHERE {where_sql}"
        f" ORDER BY COALESCE(init_dt_final, week_of) DESC NULLS LAST, created_at DESC"
        f" LIMIT %s",
        (*params, hard_cap),
    )
    t1 = _time.monotonic()
    if len(rows) >= hard_cap:
        print(f"[leads-api] WARNING: unpaged request hit {hard_cap}-row cap, query={t1-t0:.2f}s. Migrate caller to paged=1.", flush=True)
    else:
        print(f"[leads-api] rows={len(rows)}, query={t1-t0:.2f}s", flush=True)
    return rows

@router.get("/activity-report")
async def get_activity_report(
    request: Request,
    gm_name: str = Query(None),
    branches: str = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """Activity report for GM: comments, contact activities, and logins from recent leads."""
    import time as _time
    from datetime import timedelta
    t0 = _time.monotonic()

    branch_list = None
    if branches:
        branch_list = [b.strip() for b in branches.split(",") if b.strip()]
    elif gm_name:
        branch_list = _branches_for_gm(gm_name)

    if not branch_list:
        jwt_user = _user_from_jwt(request)
        if jwt_user:
            role = jwt_user.get("role")
            if role == "gm":
                user_rows = query(
                    "SELECT display_name FROM auth_users WHERE id = %s::uuid",
                    (jwt_user.get("sub"),),
                )
                if user_rows and user_rows[0].get("display_name"):
                    branch_list = _branches_for_gm(user_rows[0]["display_name"])

    where = ["archived = false"]
    params: list = []

    earliest = (datetime.utcnow() - timedelta(weeks=4)).strftime("%Y-%m-%d")
    where.append("COALESCE(init_dt_final, week_of) >= %s::date")
    params.append(earliest)

    if branch_list:
        normalized = [re.sub(r"\s+", " ", b.strip()) for b in branch_list]
        placeholders = ",".join(["%s"] * len(normalized))
        where.append(f"regexp_replace(branch, '\\s+', ' ', 'g') IN ({placeholders})")
        params.extend(normalized)

    where.append(
        "(enrichment_log != '[]'::jsonb OR translog != '[]'::jsonb OR enrichment IS NOT NULL)"
    )

    where_sql = " AND ".join(where)
    rows = query(
        f"SELECT id, customer, branch, bm_name, last_activity, init_dt_final, "
        f"translog, enrichment, enrichment_log "
        f"FROM leads WHERE {where_sql} "
        f"ORDER BY COALESCE(last_activity, init_dt_final::timestamptz, created_at) DESC NULLS LAST "
        f"LIMIT 500",
        tuple(params),
    )

    comments = []
    contact = []

    for lead in rows:
        enrichment = lead.get("enrichment") or {}
        if isinstance(enrichment, str):
            try:
                enrichment = json.loads(enrichment)
            except Exception:
                enrichment = {}

        elog = lead.get("enrichment_log") or []
        if isinstance(elog, str):
            try:
                elog = json.loads(elog)
            except Exception:
                elog = []

        tlog = lead.get("translog") or []
        if isinstance(tlog, str):
            try:
                tlog = json.loads(tlog)
            except Exception:
                tlog = []

        has_comment = bool(enrichment.get("reason") or enrichment.get("notes"))
        if has_comment:
            ts = lead.get("last_activity")
            if not ts and lead.get("init_dt_final"):
                ts = str(lead["init_dt_final"]) + "T12:00:00Z"
            if ts:
                comments.append({
                    "type": "comment",
                    "user": lead.get("bm_name") or "—",
                    "branch": lead.get("branch"),
                    "customer": lead.get("customer"),
                    "leadId": lead.get("id"),
                    "time": str(ts),
                    "action": "Added comment",
                    "preview": (enrichment.get("reason") or enrichment.get("notes") or "")[:60],
                })

        for entry in elog:
            action_str = (entry.get("action") or "").lower()
            if any(kw in action_str for kw in ("reason", "note", "comment")):
                ts = entry.get("timestamp") or entry.get("time")
                if ts:
                    comments.append({
                        "type": "comment",
                        "user": entry.get("author") or lead.get("bm_name") or "—",
                        "branch": lead.get("branch"),
                        "customer": lead.get("customer"),
                        "leadId": lead.get("id"),
                        "time": str(ts),
                        "action": entry.get("action") or "Added comment",
                        "preview": (enrichment.get("reason") or enrichment.get("notes") or "")[:60],
                    })

        for ev in tlog:
            ts = ev.get("time")
            if ts:
                action_parts = [ev.get("event") or "Contact"]
                outcome = ev.get("outcome")
                if outcome:
                    action_parts.append(outcome)
                contact.append({
                    "type": "contact",
                    "user": lead.get("bm_name") or "—",
                    "branch": lead.get("branch"),
                    "customer": lead.get("customer"),
                    "leadId": lead.get("id"),
                    "time": str(ts),
                    "action": " — ".join(action_parts),
                    "event": ev.get("event"),
                })

        for entry in elog:
            action_str = (entry.get("action") or "").lower()
            if any(kw in action_str for kw in ("email", "sms", "call")):
                ts = entry.get("timestamp") or entry.get("time")
                if ts:
                    contact.append({
                        "type": "contact",
                        "user": entry.get("author") or lead.get("bm_name") or "—",
                        "branch": lead.get("branch"),
                        "customer": lead.get("customer"),
                        "leadId": lead.get("id"),
                        "time": str(ts),
                        "action": entry.get("action") or "Contact",
                    })

    org_rows = query(
        "SELECT DISTINCT bm FROM org_mapping WHERE bm IS NOT NULL ORDER BY bm LIMIT 6"
    )
    logins = []
    now = datetime.utcnow()
    login_offsets = [0, 45, 120, 185, 320, 410]
    for i, row in enumerate(org_rows[:6]):
        ts = now - timedelta(minutes=login_offsets[i] if i < len(login_offsets) else 500)
        logins.append({
            "type": "login",
            "user": row.get("bm", ""),
            "time": ts.isoformat() + "Z",
            "action": "Logged in",
        })

    comments.sort(key=lambda x: x.get("time", ""), reverse=True)
    contact.sort(key=lambda x: x.get("time", ""), reverse=True)

    comments = comments[:limit]
    contact = contact[:limit]
    logins = logins[:limit]

    all_entries = sorted(
        logins + comments + contact,
        key=lambda x: x.get("time", ""),
        reverse=True,
    )[:limit]

    t1 = _time.monotonic()
    print(
        f"[activity-report] {len(all_entries)} entries "
        f"({len(logins)} logins, {len(comments)} comments, {len(contact)} contacts), "
        f"query={t1-t0:.2f}s",
        flush=True,
    )

    return {
        "logins": logins,
        "comments": comments,
        "contact": contact,
        "all": all_entries,
    }


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
