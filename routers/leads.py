from fastapi import APIRouter, HTTPException
import json
from db import query, execute

router = APIRouter()

@router.get("/leads")
async def get_leads():
    return query("SELECT * FROM leads WHERE archived = false ORDER BY created_at DESC")

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
    return {"ok": True}

@router.put("/leads/{lead_id}/directive")
async def update_directive(lead_id: int, body: dict):
    execute(
        "UPDATE leads SET gm_directive = %s, updated_at = now() WHERE id = %s",
        (body.get("gm_directive"), lead_id)
    )
    return {"ok": True}

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
    return {"ok": True}

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
