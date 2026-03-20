from fastapi import APIRouter
from db import query, execute

router = APIRouter()


@router.get("/wins-learnings")
async def get_wins_learnings():
    return query("SELECT * FROM wins_learnings ORDER BY created_at DESC LIMIT 200")


@router.post("/wins-learnings")
async def create_wins_learning(body: dict):
    execute(
        """INSERT INTO wins_learnings
            (bm_name, branch, gm_name, content, week_of)
        VALUES (%s, %s, %s, %s, %s)""",
        (
            body.get("bm_name"),
            body.get("branch"),
            body.get("gm_name"),
            body.get("content"),
            body.get("week_of"),
        )
    )
    rows = query("SELECT * FROM wins_learnings ORDER BY id DESC LIMIT 1")
    return rows[0] if rows else {"ok": True}
