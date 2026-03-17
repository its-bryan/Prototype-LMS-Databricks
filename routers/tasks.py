from fastapi import APIRouter, HTTPException
import json
import logging
import time
import uuid
from datetime import datetime
from db import query, execute

router = APIRouter()
log = logging.getLogger(__name__)


def _parse_uuid(s):
    """Return UUID string if s is valid UUID, else None. Avoids INSERT failure on created_by/assigned_to."""
    if s is None:
        return None
    try:
        return str(uuid.UUID(str(s))) if s else None
    except (ValueError, TypeError):
        return None

@router.get("/tasks")
async def get_tasks(lead_id: int = None, branch: str = None):
    if lead_id:
        return query("SELECT * FROM tasks WHERE lead_id = %s ORDER BY created_at DESC", (lead_id,))
    if branch:
        return query(
            """SELECT t.* FROM tasks t
               JOIN leads l ON t.lead_id = l.id
               WHERE l.branch = %s
               ORDER BY t.created_at DESC""",
            (branch,)
        )
    return query("SELECT * FROM tasks ORDER BY created_at DESC")

@router.post("/tasks")
async def create_task(body: dict):
    due_date = body.get("due_date")
    if isinstance(due_date, str) and len(due_date) > 10:
        due_date = due_date[:10]

    execute(
        """INSERT INTO tasks
            (title, description, due_date, lead_id, assigned_to, assigned_to_name,
             created_by, created_by_name, source, priority, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Open')""",
        (
            body.get("title"),
            body.get("description"),
            due_date,
            body.get("lead_id"),
            body.get("assigned_to"),
            body.get("assigned_to_name"),
            body.get("created_by"),
            body.get("created_by_name"),
            body.get("source", "gm_assigned"),
            body.get("priority", "Normal"),
        )
    )
    # Return the newly created task
    rows = query("SELECT * FROM tasks ORDER BY id DESC LIMIT 1")
    return rows[0] if rows else {"ok": True}

@router.post("/tasks/compliance")
async def create_compliance_tasks(body: dict):
    """Bulk-create tasks for outstanding leads in a branch."""
    branch = body.get("branch")
    bm_name = body.get("bmName") or body.get("bm_name")
    due_date_raw = body.get("dueDateStr") or body.get("due_date")
    gm_name = body.get("gmName") or body.get("gm_name", "GM")
    gm_user_id = body.get("gmUserId") or body.get("gm_user_id")
    raw_leads = body.get("outstandingLeads", [])
    # Frontend may send full lead objects or plain IDs
    lead_ids = [l["id"] if isinstance(l, dict) else l for l in raw_leads]

    if not branch or not lead_ids:
        return {"created": 0, "errors": []}

    # Normalize due_date to YYYY-MM-DD or None (tasks.due_date is date type)
    due_date = None
    if due_date_raw:
        s = str(due_date_raw).strip()
        if len(s) >= 10:
            due_date = s[:10]

    # created_by must be a valid UUID or NULL (demo role sends e.g. "demo-gm")
    created_by_uuid = _parse_uuid(gm_user_id)

    created = 0
    errors = []
    for raw_id in lead_ids:
        try:
            try:
                lead_id = int(raw_id)
            except (TypeError, ValueError):
                errors.append({"lead_id": raw_id, "error": "invalid lead_id"})
                continue
            execute(
                """INSERT INTO tasks
                    (title, description, due_date, lead_id, assigned_to, assigned_to_name,
                     created_by, created_by_name, source, priority, status)
                VALUES (%s, %s, %s, %s, NULL, %s, %s, %s, 'gm_assigned', 'Normal', 'Open')""",
                (
                    f"Review lead #{lead_id}",
                    f"Compliance review assigned by {gm_name}",
                    due_date,
                    lead_id,
                    bm_name,
                    created_by_uuid,
                    gm_name,
                )
            )
            created += 1
        except Exception as e:
            err_msg = str(e)
            log.warning("Compliance task INSERT failed for lead_id=%s: %s", raw_id, err_msg)
            print(f"[COMPLIANCE_INSERT_ERROR] lead_id={raw_id} error={err_msg}", flush=True)
            errors.append({"lead_id": raw_id, "error": err_msg})

    return {"created": created, "errors": errors}

@router.get("/tasks/gm")
async def get_tasks_for_gm(branches: str = ""):
    """Fetch tasks for multiple branches (comma-separated)."""
    if not branches:
        return []
    branch_list = [b.strip() for b in branches.split(",") if b.strip()]
    if not branch_list:
        return []
    placeholders = ",".join(["%s"] * len(branch_list))
    return query(
        f"""SELECT t.*, l.customer, l.reservation_id, l.branch as lead_branch
            FROM tasks t
            JOIN leads l ON t.lead_id = l.id
            WHERE l.branch IN ({placeholders})
            ORDER BY t.due_date ASC NULLS LAST, t.created_at ASC""",
        tuple(branch_list)
    )

@router.get("/tasks/{task_id}")
async def get_task(task_id: int):
    rows = query("SELECT * FROM tasks WHERE id = %s", (task_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Task not found")
    return rows[0]

@router.put("/tasks/{task_id}/status")
async def update_task_status(task_id: int, body: dict):
    new_status = body.get("status")
    completed_at = "now()" if new_status == "Done" else "NULL"
    execute(
        f"""UPDATE tasks SET
            status = %s,
            completed_at = {completed_at},
            updated_at = now()
        WHERE id = %s""",
        (new_status, task_id)
    )
    return {"ok": True}

@router.post("/tasks/{task_id}/notes")
async def append_task_note(task_id: int, body: dict):
    existing = query("SELECT notes_log FROM tasks WHERE id = %s", (task_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")

    current_log = existing[0]["notes_log"] or []
    now = datetime.now()
    current_log.append({
        "time": now.strftime("%b %d, %I:%M %p"),
        "timestamp": int(time.time() * 1000),
        "author": body.get("author", "—"),
        "note": body.get("note", ""),
    })

    execute(
        "UPDATE tasks SET notes_log = %s::jsonb, notes = %s, updated_at = now() WHERE id = %s",
        (json.dumps(current_log), body.get("note", ""), task_id)
    )
    return {"ok": True}
