from fastapi import APIRouter
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
        ("SELECT * FROM wins_learnings ORDER BY created_at DESC", None),
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
