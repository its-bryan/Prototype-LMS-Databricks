import logging

from fastapi import APIRouter
from fastapi.responses import Response, JSONResponse
from db import query

router = APIRouter()
log = logging.getLogger(__name__)


@router.get("/observatory-snapshot")
def get_observatory_snapshot():
    try:
        rows = query(
            "SELECT snapshot::text AS raw FROM observatory_snapshots"
            " ORDER BY created_at DESC LIMIT 1"
        )
    except Exception as exc:
        log.warning("observatory_snapshots query failed: %s", exc)
        return JSONResponse(content=None, status_code=200)
    if not rows or not rows[0].get("raw"):
        return JSONResponse(content=None, status_code=200)
    raw = rows[0]["raw"]
    return Response(content=raw, media_type="application/json")
