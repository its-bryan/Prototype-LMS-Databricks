from fastapi import APIRouter
from db import query

router = APIRouter()

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
