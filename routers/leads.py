from fastapi import APIRouter, HTTPException, Query
import json
import re
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


@router.get("/leads")
async def get_leads(
    branches: str = Query(None),
    branch: str = Query(None),
    gm_name: str = Query(None),
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

    if branch_list:
        placeholders = ",".join(["%s"] * len(branch_list))
        rows = query(
            f"SELECT {_LEAD_LIST_COLS} FROM leads"
            f" WHERE archived = false AND branch IN ({placeholders})"
            f" ORDER BY created_at DESC",
            tuple(branch_list),
        )
        t1 = _time.monotonic()
        print(f"[leads-api] filtered={len(branch_list)} branches, rows={len(rows)}, query={t1-t0:.2f}s", flush=True)
        return rows

    rows = query(
        f"SELECT {_LEAD_LIST_COLS} FROM leads"
        f" WHERE archived = false ORDER BY created_at DESC"
    )
    t1 = _time.monotonic()
    print(f"[leads-api] all leads, rows={len(rows)}, query={t1-t0:.2f}s", flush=True)
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
