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
        print("[snapshot-api] no snapshot rows found — returning null", flush=True)
        return JSONResponse(content=None, status_code=200)
    snap = rows[0]["snapshot"]
    if snap.get("version", 0) < 2:
        print(f"[snapshot-api] skipping stale v{snap.get('version')} snapshot — waiting for v2", flush=True)
        return JSONResponse(content=None, status_code=200)
    print(f"[snapshot-api] serving snapshot v{snap.get('version')}, computed_at={snap.get('computed_at')}, branches={len(snap.get('branches', {}))}, gms={len(snap.get('gms', {}))}", flush=True)
    return snap
