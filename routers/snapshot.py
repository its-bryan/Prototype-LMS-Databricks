"""GET /api/dashboard-snapshot — return the latest pre-computed dashboard snapshot."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from db import query

router = APIRouter()


@router.get("/dashboard-snapshot")
def get_dashboard_snapshot():
    rows = query(
        "SELECT snapshot FROM dashboard_snapshots ORDER BY created_at DESC LIMIT 1"
    )
    if not rows:
        return JSONResponse(content=None, status_code=200)
    return rows[0]["snapshot"]
