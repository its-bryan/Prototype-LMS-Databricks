from fastapi import APIRouter, HTTPException
import json
import time
from datetime import datetime
from db import query, execute

router = APIRouter()

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
