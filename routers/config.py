from fastapi import APIRouter, HTTPException
from db import query, multi_query

router = APIRouter()


@router.get("/config/all")
async def get_all_config():
    """Return all config tables in one response using a single connection."""
    results = multi_query([
        ("SELECT * FROM org_mapping ORDER BY zone, branch", None),
        ("SELECT * FROM branch_managers ORDER BY name", None),
        ("SELECT * FROM weekly_trends ORDER BY week_start DESC", None),
        ("SELECT * FROM upload_summary ORDER BY created_at DESC LIMIT 1", None),
        ("SELECT * FROM leaderboard_data ORDER BY created_at DESC LIMIT 1", None),
        ("SELECT * FROM cancellation_reason_categories ORDER BY sort_order", None),
        ("SELECT * FROM next_actions ORDER BY sort_order", None),
        ("SELECT * FROM wins_learnings ORDER BY created_at DESC LIMIT 50", None),
    ])
    return {
        "orgMapping": results[0],
        "branchManagers": results[1],
        "weeklyTrends": results[2],
        "uploadSummary": results[3][0] if results[3] else {},
        "leaderboard": results[4][0] if results[4] else {},
        "cancelReasons": results[5],
        "nextActions": results[6],
        "winsLearnings": results[7],
    }


@router.get("/config/org-mapping")
async def get_org_mapping():
    return query("SELECT * FROM org_mapping ORDER BY zone, branch")


@router.post("/config/org-mapping/seed-from-prodfiles")
async def seed_org_mapping_from_prodfiles():
    """Re-build org_mapping from the prodfiles on disk (employee listing + HLES).

    Returns a summary of how many rows were upserted and how many branches
    received a BM assignment.
    """
    import sys
    from pathlib import Path

    repo_root = Path(__file__).parent.parent
    scripts_dir = str(repo_root / "scripts")
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)

    try:
        from seed_org_mapping_from_prodfiles import build_org_mapping, upsert_org_mapping
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=f"Could not import seed script: {exc}")

    prodfiles = repo_root / "prodfiles"
    hles_candidates = sorted(prodfiles.glob("All IR Detail*.xlsx"))
    emp_candidates = sorted(prodfiles.glob("March 2026 employee listing*.xlsx"))

    if not hles_candidates:
        raise HTTPException(status_code=422, detail="No HLES file found in prodfiles/ (expected 'All IR Detail*.xlsx')")
    if not emp_candidates:
        raise HTTPException(status_code=422, detail="No employee listing found in prodfiles/ (expected 'March 2026 employee listing*.xlsx')")

    hles_path = hles_candidates[-1]
    emp_path = emp_candidates[-1]

    try:
        rows = build_org_mapping(hles_path, emp_path)
        upsert_org_mapping(rows)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    assigned = sum(1 for r in rows if r["bm"])
    return {
        "ok": True,
        "total": len(rows),
        "bm_assigned": assigned,
        "hles_file": hles_path.name,
        "employee_file": emp_path.name,
    }

@router.patch("/config/org-mapping/{branch}/bm")
async def update_org_mapping_bm(branch: str, body: dict):
    """Manually update the BM for a single branch."""
    from db import execute
    bm = (body.get("bm") or "").strip()
    execute(
        "UPDATE org_mapping SET bm = %s, updated_at = now() WHERE branch = %s",
        (bm, branch),
    )
    return {"ok": True, "branch": branch, "bm": bm}


@router.get("/config/branch-managers")
async def get_branch_managers():
    return query("SELECT * FROM branch_managers ORDER BY name")

@router.get("/config/weekly-trends")
async def get_weekly_trends():
    return query("SELECT * FROM weekly_trends ORDER BY week_start DESC")

@router.get("/config/upload-summary")
async def get_upload_summary():
    rows = query("SELECT * FROM upload_summary ORDER BY created_at DESC LIMIT 1")
    return rows[0] if rows else {}

@router.get("/config/leaderboard")
async def get_leaderboard():
    rows = query("SELECT * FROM leaderboard_data ORDER BY created_at DESC LIMIT 1")
    return rows[0] if rows else {}

@router.get("/config/cancel-reasons")
async def get_cancel_reasons():
    return query("SELECT * FROM cancellation_reason_categories ORDER BY sort_order")

@router.get("/config/next-actions")
async def get_next_actions():
    return query("SELECT * FROM next_actions ORDER BY sort_order")
