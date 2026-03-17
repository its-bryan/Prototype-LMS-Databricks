from fastapi import APIRouter, UploadFile, File
import pandas as pd
import json
import io
import os
import re
from datetime import datetime
from db import execute, query
from etl.clean import clean_hles_data, clean_translog_data

router = APIRouter()

# Unity Catalog Volume for HLES landing: datalabs.lab_lms_prod.hles_landing_prod
# Override with env HLES_LANDING_VOLUME_PATH (e.g. empty to skip Volume write when testing locally).
# Behavior: see docs/VOLUME-LANDING-BEHAVIOR.md. Test: python scripts/test_volume_landing.py
HLES_LANDING_VOLUME_PATH = os.getenv("HLES_LANDING_VOLUME_PATH", "/Volumes/datalabs/lab_lms_prod/hles_landing_prod")
TRANSLOG_LANDING_VOLUME_PATH = os.getenv(
    "TRANSLOG_LANDING_VOLUME_PATH", "/Volumes/datalabs/lab_lms_prod/translog_landing_prod"
)


def _land_file_in_volume(contents: bytes, original_filename: str, base_path: str) -> str | None:
    """Write uploaded file to a Unity Catalog Volume. Returns path if written, else None."""
    if not base_path or not contents:
        return None
    safe_name = re.sub(r"[^\w\-\.]", "_", original_filename or "upload.xlsx")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{safe_name}"
    base = base_path.rstrip("/")
    path = f"{base}/{filename}" if base else None
    if not path:
        return None
    try:
        with open(path, "wb") as f:
            f.write(contents)
        return path
    except Exception:
        return None


def _build_org_lookup() -> dict:
    """Build branch -> bm_name mapping from org_mapping table."""
    rows = query("SELECT branch, bm FROM org_mapping")
    return {r["branch"]: r["bm"] for r in rows} if rows else {}


def _val(row, col):
    """Safely get a value from a row, converting NaN/NaT to None."""
    v = row.get(col)
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    if pd.isna(v):
        return None
    return v


@router.post("/upload/hles")
async def upload_hles(file: UploadFile = File(...)):
    """Upload HLES Excel file -> land in Volume (if configured) -> ETL -> insert/update leads table."""
    contents = await file.read()
    # Land raw file in Unity Catalog Volume for audit/re-run (datalabs.lab_lms_prod.hles_landing_prod)
    landed_path = _land_file_in_volume(contents, file.filename or "hles.xlsx", HLES_LANDING_VOLUME_PATH)
    df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

    org_lookup = _build_org_lookup()
    df_clean = clean_hles_data(df, org_lookup)

    stats = {"rowsParsed": len(df), "newLeads": 0, "updated": 0, "failed": 0}
    if landed_path:
        stats["landedPath"] = landed_path

    for _, row in df_clean.iterrows():
        try:
            confirm_num = _val(row, "confirm_num")
            if not confirm_num:
                stats["failed"] += 1
                continue
            # Match by confirmation number (business key); reservation_id = confirm_num for display
            existing = query(
                "SELECT id FROM leads WHERE confirm_num = %s",
                (confirm_num,)
            )
            if existing:
                execute(
                    """UPDATE leads SET
                        customer = %s, status = %s, branch = %s, bm_name = %s,
                        insurance_company = %s, hles_reason = %s, init_dt_final = %s,
                        confirm_num = %s, reservation_id = %s, knum = %s, body_shop = %s,
                        cdp_name = %s, htz_region = %s, set_state = %s,
                        zone = %s, area_mgr = %s, general_mgr = %s,
                        rent_loc = %s, week_of = %s, contact_range = %s,
                        updated_at = now()
                    WHERE confirm_num = %s""",
                    (
                        _val(row, "customer"), _val(row, "status"),
                        _val(row, "branch"), _val(row, "bm_name"),
                        _val(row, "insurance_company"), _val(row, "hles_reason"),
                        _val(row, "init_dt_final"),
                        confirm_num, confirm_num,
                        _val(row, "knum"), _val(row, "body_shop"), _val(row, "cdp_name"),
                        _val(row, "htz_region"), _val(row, "set_state"),
                        _val(row, "zone"), _val(row, "area_mgr"),
                        _val(row, "general_mgr"), _val(row, "rent_loc"),
                        _val(row, "week_of"), _val(row, "contact_range"),
                        confirm_num,
                    )
                )
                stats["updated"] += 1
            else:
                execute(
                    """INSERT INTO leads
                        (customer, reservation_id, status, branch, bm_name,
                         insurance_company, hles_reason, init_dt_final,
                         confirm_num, knum, body_shop, cdp_name, htz_region,
                         set_state, zone, area_mgr, general_mgr, rent_loc,
                         week_of, contact_range)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        _val(row, "customer"), confirm_num,
                        _val(row, "status"), _val(row, "branch"),
                        _val(row, "bm_name"), _val(row, "insurance_company"),
                        _val(row, "hles_reason"), _val(row, "init_dt_final"),
                        confirm_num, _val(row, "knum"),
                        _val(row, "body_shop"), _val(row, "cdp_name"),
                        _val(row, "htz_region"), _val(row, "set_state"),
                        _val(row, "zone"), _val(row, "area_mgr"),
                        _val(row, "general_mgr"), _val(row, "rent_loc"),
                        _val(row, "week_of"), _val(row, "contact_range"),
                    )
                )
                stats["newLeads"] += 1
        except Exception as e:
            stats["failed"] += 1

    execute(
        "INSERT INTO upload_summary (hles, translog, data_as_of_date) VALUES (%s::jsonb, %s::jsonb, %s)",
        (json.dumps(stats), '{}', str(pd.Timestamp.now().date()))
    )

    return stats

@router.post("/upload/translog")
async def upload_translog(file: UploadFile = File(...)):
    """Upload TRANSLOG Excel file -> land in Volume (if configured) -> match events to leads."""
    contents = await file.read()
    # Land raw file in Unity Catalog Volume (datalabs.lab_lms_prod.translog_landing_prod)
    landed_path = _land_file_in_volume(
        contents, file.filename or "translog.xlsx", TRANSLOG_LANDING_VOLUME_PATH
    )
    df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

    df_clean = clean_translog_data(df)

    stats = {"eventsParsed": len(df), "matched": 0, "orphan": 0}
    if landed_path:
        stats["landedPath"] = landed_path

    for _, row in df_clean.iterrows():
        # Match lead by confirm_num (preferred) or reservation_id for backward compatibility
        key = row.get("confirm_num") or row.get("reservation_id")
        if not key:
            stats["orphan"] += 1
            continue
        existing = query(
            "SELECT id, translog FROM leads WHERE confirm_num = %s OR reservation_id = %s LIMIT 1",
            (key, key)
        )
        if existing:
            lead = existing[0]
            current_log = lead["translog"] or []
            current_log.append({
                "time": str(row.get("event_time", "")),
                "event": row.get("event_type", ""),
                "outcome": row.get("outcome", "")
            })
            execute(
                """UPDATE leads SET
                    translog = %s::jsonb,
                    last_activity = now(),
                    updated_at = now()
                WHERE id = %s""",
                (json.dumps(current_log), lead["id"])
            )
            stats["matched"] += 1
        else:
            stats["orphan"] += 1

    return stats
