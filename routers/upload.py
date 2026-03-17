from fastapi import APIRouter, UploadFile, File, Form
import pandas as pd
import json
import io
import os
import re
from datetime import datetime
from db import execute, query, with_connection
from etl.clean import clean_hles_data, clean_translog_data

router = APIRouter()

# Batch sizes to reduce DB round-trips and stay under gateway timeout (e.g. 60s)
HLES_SELECT_CHUNK = 2000
HLES_INSERT_BATCH = 500
HLES_UPDATE_BATCH = 500

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


def _row_to_tuple(row, confirm_num):
    """One row as tuple for INSERT (customer, reservation_id, status, ..., contact_range)."""
    return (
        _val(row, "customer"), confirm_num,
        _val(row, "status"), _val(row, "branch"), _val(row, "bm_name"),
        _val(row, "insurance_company"), _val(row, "hles_reason"), _val(row, "init_dt_final"),
        confirm_num, _val(row, "knum"), _val(row, "body_shop"), _val(row, "cdp_name"),
        _val(row, "htz_region"), _val(row, "set_state"), _val(row, "zone"),
        _val(row, "area_mgr"), _val(row, "general_mgr"), _val(row, "rent_loc"),
        _val(row, "week_of"), _val(row, "contact_range"),
    )


def _row_to_update_tuple(row, confirm_num):
    """One row as tuple for UPDATE FROM VALUES (confirm_num, customer, status, ..., contact_range)."""
    return (
        confirm_num,
        _val(row, "customer"), _val(row, "status"), _val(row, "branch"), _val(row, "bm_name"),
        _val(row, "insurance_company"), _val(row, "hles_reason"), _val(row, "init_dt_final"),
        confirm_num, confirm_num, _val(row, "knum"), _val(row, "body_shop"), _val(row, "cdp_name"),
        _val(row, "htz_region"), _val(row, "set_state"), _val(row, "zone"),
        _val(row, "area_mgr"), _val(row, "general_mgr"), _val(row, "rent_loc"),
        _val(row, "week_of"), _val(row, "contact_range"),
    )


def _upsert_org_mapping_from_hles(rows_to_process, cur):
    """Upsert org_mapping from distinct (branch, bm_name, area_mgr, general_mgr, zone) in uploaded HLES rows."""
    # One row per branch (last occurrence wins)
    by_branch = {}
    for _confirm_num, row in rows_to_process:
        branch = _val(row, "branch")
        if not branch or not str(branch).strip():
            continue
        bm = _val(row, "bm_name") or ""
        am = _val(row, "area_mgr") or ""
        gm = _val(row, "general_mgr")  # nullable in org_mapping
        zone = _val(row, "zone")
        if zone is None:
            zone = ""
        by_branch[str(branch).strip()] = (bm, am, gm, str(zone).strip() or "")

    if not by_branch:
        return
    sql = """
        INSERT INTO org_mapping (bm, branch, am, gm, zone)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (branch) DO UPDATE SET
            bm = EXCLUDED.bm,
            am = EXCLUDED.am,
            gm = EXCLUDED.gm,
            zone = EXCLUDED.zone,
            updated_at = now()
    """
    for branch, (bm, am, gm, zone) in by_branch.items():
        cur.execute(sql, (bm, branch, am, gm, zone))


@router.get("/upload/history")
def get_upload_history():
    """Return all upload_summary rows for the upload history UI (date, who, status, metadata)."""
    rows = query(
        "SELECT id, created_at, hles, translog, data_as_of_date FROM upload_summary ORDER BY created_at DESC LIMIT 200"
    )
    return rows or []


@router.post("/upload/hles")
async def upload_hles(
    file: UploadFile = File(...),
    uploaded_by: str | None = Form(None),
):
    """Upload HLES Excel file -> land in Volume (if configured) -> ETL -> batch insert/update leads."""
    contents = await file.read()
    landed_path = _land_file_in_volume(contents, file.filename or "hles.xlsx", HLES_LANDING_VOLUME_PATH)
    df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

    org_lookup = _build_org_lookup()
    df_clean = clean_hles_data(df, org_lookup)

    stats = {"rowsParsed": len(df), "newLeads": 0, "updated": 0, "failed": 0}
    if landed_path:
        stats["landedPath"] = landed_path
    if file.filename:
        stats["filename"] = file.filename
    if uploaded_by:
        stats["uploaded_by"] = uploaded_by

    # Build list of (confirm_num, row) for valid rows
    rows_to_process = []
    for _, row in df_clean.iterrows():
        confirm_num = _val(row, "confirm_num")
        if not confirm_num:
            stats["failed"] += 1
            continue
        rows_to_process.append((confirm_num, row))

    if not rows_to_process:
        execute(
            "INSERT INTO upload_summary (hles, translog, data_as_of_date) VALUES (%s::jsonb, %s::jsonb, %s)",
            (json.dumps(stats), "{}", str(pd.Timestamp.now().date())),
        )
        return stats

    with with_connection() as conn:
        with conn.cursor() as cur:
            # 1) Bulk-fetch existing confirm_nums (chunked)
            confirm_nums = [c for c, _ in rows_to_process]
            existing_confirm_nums = set()
            for i in range(0, len(confirm_nums), HLES_SELECT_CHUNK):
                chunk = confirm_nums[i : i + HLES_SELECT_CHUNK]
                placeholders = ",".join(["%s"] * len(chunk))
                cur.execute(
                    f"SELECT confirm_num FROM leads WHERE confirm_num IN ({placeholders})",
                    tuple(chunk),
                )
                for r in cur.fetchall():
                    existing_confirm_nums.add(r["confirm_num"])

            # 2) Split into insert vs update
            to_insert = [(c, r) for c, r in rows_to_process if c not in existing_confirm_nums]
            to_update = [(c, r) for c, r in rows_to_process if c in existing_confirm_nums]

            # 3) Batch INSERT
            cols = (
                "customer, reservation_id, status, branch, bm_name, insurance_company, hles_reason, init_dt_final, "
                "confirm_num, knum, body_shop, cdp_name, htz_region, set_state, zone, area_mgr, general_mgr, rent_loc, week_of, contact_range"
            )
            for i in range(0, len(to_insert), HLES_INSERT_BATCH):
                batch = to_insert[i : i + HLES_INSERT_BATCH]
                values_tuples = [_row_to_tuple(r, c) for c, r in batch]
                n = len(values_tuples)
                one = "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
                placeholders = ",".join([one] * n)
                sql = f"INSERT INTO leads ({cols}) VALUES {placeholders}"
                cur.execute(sql, tuple(x for t in values_tuples for x in t))
                stats["newLeads"] += n

            # 4) Batch UPDATE (UPDATE ... FROM (VALUES ...))
            for i in range(0, len(to_update), HLES_UPDATE_BATCH):
                batch = to_update[i : i + HLES_UPDATE_BATCH]
                values_tuples = [_row_to_update_tuple(r, c) for c, r in batch]
                n = len(values_tuples)
                one = "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
                placeholders = ",".join([one] * n)
                sql = f"""UPDATE leads SET
                    customer = v.customer, status = v.status, branch = v.branch, bm_name = v.bm_name,
                    insurance_company = v.insurance_company, hles_reason = v.hles_reason, init_dt_final = v.init_dt_final,
                    confirm_num = v.confirm_num, reservation_id = v.reservation_id, knum = v.knum, body_shop = v.body_shop,
                    cdp_name = v.cdp_name, htz_region = v.htz_region, set_state = v.set_state,
                    zone = v.zone, area_mgr = v.area_mgr, general_mgr = v.general_mgr, rent_loc = v.rent_loc,
                    week_of = v.week_of, contact_range = v.contact_range, updated_at = now()
                FROM (VALUES {placeholders}) AS v(confirm_num, customer, status, branch, bm_name, insurance_company, hles_reason, init_dt_final, confirm_num2, reservation_id, knum, body_shop, cdp_name, htz_region, set_state, zone, area_mgr, general_mgr, rent_loc, week_of, contact_range)
                WHERE leads.confirm_num = v.confirm_num"""
                cur.execute(sql, tuple(x for t in values_tuples for x in t))
                stats["updated"] += n

            # 5) Sync org_mapping from HLES (branch -> bm, am, gm, zone) so GM view and org mapping UI stay in sync
            _upsert_org_mapping_from_hles(rows_to_process, cur)

    execute(
        "INSERT INTO upload_summary (hles, translog, data_as_of_date) VALUES (%s::jsonb, %s::jsonb, %s)",
        (json.dumps(stats), "{}", str(pd.Timestamp.now().date())),
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
