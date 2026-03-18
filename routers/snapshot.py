"""GET /api/dashboard-snapshot — return the latest pre-computed dashboard snapshot."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response
from db import query

router = APIRouter()


@router.get("/dashboard-snapshot")
def get_dashboard_snapshot():
    import time as _time
    t0 = _time.monotonic()
    rows = query(
        "SELECT snapshot::text AS raw FROM dashboard_snapshots ORDER BY created_at DESC LIMIT 1"
    )
    t_query = _time.monotonic()
    if not rows or not rows[0]["raw"]:
        print("[snapshot-api] no snapshot rows found — returning null", flush=True)
        return JSONResponse(content=None, status_code=200)
    raw = rows[0]["raw"]
    is_v2 = '"version": 2' in raw[:50] or '"version":2' in raw[:50]
    if not is_v2:
        print("[snapshot-api] skipping stale snapshot — waiting for v2", flush=True)
        return JSONResponse(content=None, status_code=200)
    print(f"[snapshot-api] serving snapshot, raw={len(raw)} bytes, query={t_query - t0:.2f}s", flush=True)
    return Response(content=raw, media_type="application/json")
