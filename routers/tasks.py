from fastapi import APIRouter, HTTPException, Query
import json
import logging
import re
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
async def get_tasks(
    lead_id: int = None,
    branch: str = None,
    statuses: str = Query(None),
    search: str = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    paged: bool = Query(False),
):
    if lead_id and not paged and not statuses and not search:
        return query("SELECT * FROM tasks WHERE lead_id = %s ORDER BY created_at DESC", (lead_id,))

    where = []
    params = []
    normalized = None
    if branch:
        normalized = " ".join(branch.split())
        where.append("trim(regexp_replace(l.branch, '\\s+', ' ', 'g')) = %s")
        params.append(normalized)

    if lead_id:
        where.append("t.lead_id = %s")
        params.append(lead_id)

    if statuses:
        status_list = [s.strip() for s in statuses.split(",") if s.strip()]
        if status_list:
            placeholders = ",".join(["%s"] * len(status_list))
            where.append(f"t.status IN ({placeholders})")
            params.extend(status_list)

    if search:
        like = f"%{search.strip()}%"
        where.append("(t.title ILIKE %s OR COALESCE(l.customer, '') ILIKE %s)")
        params.extend([like, like])

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    base_from = (
        " FROM tasks t"
        " LEFT JOIN leads l ON t.lead_id = l.id"
    )
    select_cols = (
        "SELECT t.*, l.customer, l.reservation_id, l.branch as lead_branch, l.status as lead_status"
    )

    if paged:
        count_rows = query(f"SELECT COUNT(*)::int AS total{base_from} {where_sql}", tuple(params))
        total = count_rows[0]["total"] if count_rows else 0
        rows = query(
            f"{select_cols}{base_from} {where_sql}"
            " ORDER BY t.created_at DESC LIMIT %s OFFSET %s",
            tuple([*params, limit, offset]),
        )
        return {
            "items": rows,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_next": (offset + limit) < total,
        }

    hard_cap = 500
    if branch or statuses or search:
        rows = query(
            f"{select_cols}{base_from} {where_sql} ORDER BY t.created_at DESC LIMIT %s",
            tuple([*params, hard_cap]),
        )
        if len(rows) >= hard_cap:
            print(f"[tasks-api] WARNING: unpaged /tasks hit {hard_cap}-row cap. Migrate caller to paged=1.", flush=True)
        return rows
    rows = query(f"SELECT * FROM tasks ORDER BY created_at DESC LIMIT %s", (hard_cap,))
    if len(rows) >= hard_cap:
        print(f"[tasks-api] WARNING: unpaged /tasks hit {hard_cap}-row cap. Migrate caller to paged=1.", flush=True)
    return rows

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
    """Bulk-create tasks for outstanding leads in a branch. If a lead already has an open task, append a reminder note instead of creating a duplicate."""
    branch = body.get("branch")
    bm_name = body.get("bmName") or body.get("bm_name")
    due_date_raw = body.get("dueDateStr") or body.get("due_date")
    gm_name = body.get("gmName") or body.get("gm_name", "GM")
    gm_user_id = body.get("gmUserId") or body.get("gm_user_id")
    raw_leads = body.get("outstandingLeads", [])
    # Frontend may send full lead objects or plain IDs
    lead_ids_raw = [l["id"] if isinstance(l, dict) else l for l in raw_leads]

    if not branch or not lead_ids_raw:
        return {"created": 0, "reminded": 0, "errors": []}

    # Normalize due_date to YYYY-MM-DD or None (tasks.due_date is date type)
    due_date = None
    if due_date_raw:
        s = str(due_date_raw).strip()
        if len(s) >= 10:
            due_date = s[:10]

    # created_by must be a valid UUID or NULL (demo role sends e.g. "demo-gm")
    created_by_uuid = _parse_uuid(gm_user_id)

    created = 0
    reminded = 0
    errors = []

    # Resolve valid integer lead_ids and collect invalid ones
    lead_ids = []
    for raw_id in lead_ids_raw:
        try:
            lead_ids.append(int(raw_id))
        except (TypeError, ValueError):
            errors.append({"lead_id": raw_id, "error": "invalid lead_id"})

    if not lead_ids:
        return {"created": 0, "reminded": 0, "errors": errors}

    # Bulk lookup: one open task per lead (latest by created_at)
    open_tasks_by_lead = {}
    if lead_ids:
        rows = query(
            """SELECT DISTINCT ON (lead_id) lead_id, id, notes_log
               FROM tasks
               WHERE lead_id = ANY(%s) AND status IN ('Open', 'In Progress')
               ORDER BY lead_id, created_at DESC""",
            (lead_ids,),
        )
        for r in rows or []:
            open_tasks_by_lead[r["lead_id"]] = (r["id"], r.get("notes_log") or [])

    reminder_note = "Compliance reminder from GM (meeting prep)."
    now = datetime.now()
    reminder_entry = {
        "time": now.strftime("%b %d, %I:%M %p"),
        "timestamp": int(time.time() * 1000),
        "author": gm_name,
        "note": reminder_note,
    }

    for lead_id in lead_ids:
        raw_id = lead_id
        if lead_id in open_tasks_by_lead:
            task_id, current_log = open_tasks_by_lead[lead_id]
            try:
                new_log = list(current_log) + [reminder_entry]
                execute(
                    "UPDATE tasks SET notes_log = %s::jsonb, notes = %s, updated_at = now() WHERE id = %s",
                    (json.dumps(new_log), reminder_note, task_id),
                )
                reminded += 1
            except Exception as e:
                err_msg = str(e)
                log.warning("Compliance reminder UPDATE failed for lead_id=%s task_id=%s: %s", lead_id, task_id, err_msg)
                errors.append({"lead_id": raw_id, "error": err_msg})
        else:
            try:
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
                    ),
                )
                created += 1
            except Exception as e:
                err_msg = str(e)
                log.warning("Compliance task INSERT failed for lead_id=%s: %s", raw_id, err_msg)
                print(f"[COMPLIANCE_INSERT_ERROR] lead_id={raw_id} error={err_msg}", flush=True)
                errors.append({"lead_id": raw_id, "error": err_msg})

    return {"created": created, "reminded": reminded, "errors": errors}

@router.get("/tasks/gm")
async def get_tasks_for_gm(
    branches: str = "",
    statuses: str = Query(None),
    search: str = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    paged: bool = Query(False),
):
    """Fetch tasks for multiple branches (comma-separated)."""
    if not branches:
        return []
    branch_list = [b.strip() for b in branches.split(",") if b.strip()]
    if not branch_list:
        return []
    normalized = [re.sub(r"\s+", " ", b.strip()) for b in branch_list]
    placeholders = ",".join(["%s"] * len(normalized))
    where = [f"regexp_replace(l.branch, '\\s+', ' ', 'g') IN ({placeholders})"]
    params = [*normalized]

    if statuses:
        status_list = [s.strip() for s in statuses.split(",") if s.strip()]
        if status_list:
            status_placeholders = ",".join(["%s"] * len(status_list))
            where.append(f"t.status IN ({status_placeholders})")
            params.extend(status_list)

    if search:
        like = f"%{search.strip()}%"
        where.append("(t.title ILIKE %s OR COALESCE(l.customer, '') ILIKE %s)")
        params.extend([like, like])

    where_sql = " AND ".join(where)
    select_cols = "SELECT t.*, l.customer, l.reservation_id, l.branch as lead_branch, l.status as lead_status"
    from_sql = " FROM tasks t JOIN leads l ON t.lead_id = l.id"

    if paged:
        count_rows = query(f"SELECT COUNT(*)::int AS total{from_sql} WHERE {where_sql}", tuple(params))
        total = count_rows[0]["total"] if count_rows else 0
        rows = query(
            f"{select_cols}{from_sql} WHERE {where_sql} ORDER BY t.due_date ASC NULLS LAST, t.created_at ASC LIMIT %s OFFSET %s",
            tuple([*params, limit, offset]),
        )
        return {
            "items": rows,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_next": (offset + limit) < total,
        }

    hard_cap = 500
    rows = query(
        f"{select_cols}{from_sql} WHERE {where_sql} ORDER BY t.due_date ASC NULLS LAST, t.created_at ASC LIMIT %s",
        tuple([*params, hard_cap]),
    )
    if len(rows) >= hard_cap:
        print(f"[tasks-api] WARNING: unpaged /tasks/gm hit {hard_cap}-row cap. Migrate caller to paged=1.", flush=True)
    return rows

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
