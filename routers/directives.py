from fastapi import APIRouter
from db import query, execute

router = APIRouter()


@router.get("/leads/{lead_id}/directives")
async def get_directives(lead_id: int):
    return query(
        "SELECT * FROM gm_directives WHERE lead_id = %s ORDER BY created_at DESC",
        (lead_id,)
    )


@router.post("/leads/{lead_id}/directives")
async def create_directive(lead_id: int, body: dict):
    execute(
        """INSERT INTO gm_directives
            (lead_id, directive_text, priority, due_date, created_by, created_by_name)
        VALUES (%s, %s, %s, %s, %s, %s)""",
        (
            lead_id,
            body.get("directive_text"),
            body.get("priority", "normal"),
            body.get("due_date"),
            body.get("created_by"),
            body.get("created_by_name"),
        )
    )
    rows = query(
        "SELECT * FROM gm_directives WHERE lead_id = %s ORDER BY created_at DESC LIMIT 1",
        (lead_id,)
    )
    return rows[0] if rows else {"ok": True}
