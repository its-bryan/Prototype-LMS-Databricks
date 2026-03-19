from fastapi import APIRouter
from fastapi.responses import Response, JSONResponse
from db import query

router = APIRouter()


@router.get("/observatory-snapshot")
def get_observatory_snapshot():
    rows = query(
        "SELECT snapshot::text AS raw FROM observatory_snapshots"
        " ORDER BY created_at DESC LIMIT 1"
    )
    if not rows or not rows[0].get("raw"):
        return JSONResponse(content=None, status_code=200)
    raw = rows[0]["raw"]
    return Response(content=raw, media_type="application/json")
