from collections import defaultdict

from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
import pandas as pd
import json
import io
import os
import re
import time as _time
from datetime import datetime
from zoneinfo import ZoneInfo
from db import execute, query, with_connection

_ET = ZoneInfo("America/New_York")
from etl.clean import clean_hles_data, clean_translog_data
from services.snapshot import compute_and_store_snapshot
from services.observatory_snapshot import compute_observatory_snapshot
from services.days_open import refresh_days_open

router = APIRouter()
_ET = ZoneInfo("America/New_York")

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

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB


def _norm_translog_key(k):
    if k is None:
        return None
    if isinstance(k, float) and pd.isna(k):
        return None
    if pd.isna(k):
        return None
    s = str(k).strip()
    return s if s else None


def _land_file_in_volume(contents: bytes, original_filename: str, base_path: str) -> str | None:
    """Write uploaded file to a Unity Catalog Volume. Returns path if written, else None."""
    if not base_path or not contents:
        return None
    safe_name = re.sub(r"[^\w\-\.]", "_", original_filename or "upload.xlsx")
    timestamp = datetime.now(_ET).strftime("%Y%m%d_%H%M%S")
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
        _val(row, "first_contact_by"),
        _val(row, "time_to_first_contact"),
        _val(row, "mmr"),
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
        _val(row, "first_contact_by"),
        _val(row, "time_to_first_contact"),
        _val(row, "mmr"),
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


def _set_ingestion_status(upload_id, state: str, error: str | None = None, counts: dict | None = None):
    rows = query("SELECT hles FROM upload_summary WHERE id = %s", (str(upload_id),))
    if not rows:
        return
    hles = dict(rows[0].get("hles") or {})
    hles["ingestion_status"] = state
    hles["ingestion_updated_at"] = datetime.now(_ET).isoformat()
    if error:
        hles["ingestion_error"] = error
    else:
        hles.pop("ingestion_error", None)
    if counts:
        hles.update(counts)
    execute("UPDATE upload_summary SET hles = %s::jsonb WHERE id = %s", (json.dumps(hles), str(upload_id)))


def _relink_translog_events():
    """Re-link orphan translog_events to leads after new HLES upload."""
    try:
        rows = query("""
            WITH matched AS (
                UPDATE translog_events te
                SET lead_id = l.id
                FROM leads l
                WHERE te.lead_id IS NULL
                  AND (
                      (te.knum IS NOT NULL AND te.knum = l.knum)
                      OR (te.rez_num IS NOT NULL AND te.rez_num = l.confirm_num)
                  )
                RETURNING te.id
            )
            SELECT COUNT(*) AS cnt FROM matched
        """)
        count = rows[0]["cnt"] if rows else 0
        if count > 0:
            print(f"[upload] re-linked {count} orphan translog events to leads", flush=True)
    except Exception as exc:
        print(f"[upload] translog re-link failed (non-fatal): {exc}", flush=True)


def _run_post_upload_jobs(upload_id, counts: dict | None = None):
    try:
        compute_and_store_snapshot()
        compute_observatory_snapshot()
        refresh_days_open()
        _relink_translog_events()
        _set_ingestion_status(upload_id, "success", counts=counts)
        print(f"[upload] post-upload ingestion succeeded for {upload_id}", flush=True)
    except Exception as exc:
        _set_ingestion_status(upload_id, "failed", str(exc))
        print(f"[upload] post-upload ingestion failed for {upload_id}: {exc}", flush=True)


@router.get("/upload/history")
def get_upload_history():
    """Return all upload_summary rows for the upload history UI (date, who, status, metadata)."""
    rows = query(
        "SELECT id, created_at, hles, translog, data_as_of_date FROM upload_summary ORDER BY created_at DESC LIMIT 200"
    )
    return rows or []


@router.get("/upload/ingestion-status/{upload_id}")
def get_ingestion_status(upload_id: str):
    rows = query("SELECT hles FROM upload_summary WHERE id = %s", (upload_id,))
    if not rows:
        return {"state": "unknown"}
    hles = rows[0].get("hles") or {}
    state = hles.get("ingestion_status") or "success"
    return {
        "state": state,
        "startedAt": hles.get("ingestion_started_at"),
        "updatedAt": hles.get("ingestion_updated_at"),
        "error": hles.get("ingestion_error"),
        "newLeads": hles.get("newLeads", 0),
        "updated": hles.get("updated", 0),
        "failed": hles.get("failed", 0),
        "rowsParsed": hles.get("rowsParsed", 0),
    }


@router.post("/upload/hles")
async def upload_hles(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    uploaded_by: str | None = Form(None),
):
    """Upload HLES Excel file -> land in Volume (if configured) -> ETL -> batch insert/update leads."""
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File too large ({len(contents) / 1024 / 1024:.1f} MB). Maximum is 50 MB. "
                "For historical bulk loads, use the admin CLI."
            ),
        )
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
    stats["ingestion_status"] = "in_progress"
    stats["ingestion_started_at"] = datetime.now(_ET).isoformat()

    # Build list of (confirm_num, row) for valid rows
    rows_to_process = []
    for _, row in df_clean.iterrows():
        confirm_num = _val(row, "confirm_num")
        if not confirm_num:
            stats["failed"] += 1
            continue
        rows_to_process.append((confirm_num, row))

    if not rows_to_process:
        stats["ingestion_status"] = "failed"
        stats["ingestion_error"] = "No valid rows to ingest."
        stats["ingestion_updated_at"] = datetime.now(_ET).isoformat()
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
                "confirm_num, knum, body_shop, cdp_name, htz_region, set_state, zone, area_mgr, general_mgr, rent_loc, week_of, contact_range, first_contact_by, time_to_first_contact, mmr"
            )
            for i in range(0, len(to_insert), HLES_INSERT_BATCH):
                batch = to_insert[i : i + HLES_INSERT_BATCH]
                values_tuples = [_row_to_tuple(r, c) for c, r in batch]
                n = len(values_tuples)
                one = "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
                placeholders = ",".join([one] * n)
                sql = f"INSERT INTO leads ({cols}) VALUES {placeholders}"
                cur.execute(sql, tuple(x for t in values_tuples for x in t))
                stats["newLeads"] += n

            # 4) Batch UPDATE (UPDATE ... FROM (VALUES ...))
            for i in range(0, len(to_update), HLES_UPDATE_BATCH):
                batch = to_update[i : i + HLES_UPDATE_BATCH]
                values_tuples = [_row_to_update_tuple(r, c) for c, r in batch]
                n = len(values_tuples)
                one = "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
                placeholders = ",".join([one] * n)
                sql = f"""UPDATE leads SET
                    customer = v.customer, status = v.status, branch = v.branch, bm_name = v.bm_name,
                    insurance_company = v.insurance_company, hles_reason = v.hles_reason, init_dt_final = v.init_dt_final,
                    confirm_num = v.confirm_num, reservation_id = v.reservation_id, knum = v.knum, body_shop = v.body_shop,
                    cdp_name = v.cdp_name, htz_region = v.htz_region, set_state = v.set_state,
                    zone = v.zone, area_mgr = v.area_mgr, general_mgr = v.general_mgr, rent_loc = v.rent_loc,
                    week_of = v.week_of, contact_range = v.contact_range, first_contact_by = v.first_contact_by, time_to_first_contact = v.time_to_first_contact, mmr = v.mmr, updated_at = now()
                FROM (VALUES {placeholders}) AS v(confirm_num, customer, status, branch, bm_name, insurance_company, hles_reason, init_dt_final, confirm_num2, reservation_id, knum, body_shop, cdp_name, htz_region, set_state, zone, area_mgr, general_mgr, rent_loc, week_of, contact_range, first_contact_by, time_to_first_contact, mmr)
                WHERE leads.confirm_num = v.confirm_num"""
                cur.execute(sql, tuple(x for t in values_tuples for x in t))
                stats["updated"] += n

            # 5) Sync org_mapping from HLES (branch -> bm, am, gm, zone) so GM view and org mapping UI stay in sync
            _upsert_org_mapping_from_hles(rows_to_process, cur)

    inserted = query(
        "INSERT INTO upload_summary (hles, translog, data_as_of_date) VALUES (%s::jsonb, %s::jsonb, %s) RETURNING id",
        (json.dumps(stats), "{}", str(pd.Timestamp.now().date())),
    )
    upload_id = inserted[0]["id"] if inserted else None
    if upload_id:
        count_snapshot = {
            "newLeads": stats.get("newLeads", 0),
            "updated": stats.get("updated", 0),
            "failed": stats.get("failed", 0),
            "rowsParsed": stats.get("rowsParsed", 0),
        }
        background_tasks.add_task(_run_post_upload_jobs, upload_id, count_snapshot)
        print(f"[upload] HLES ETL done — ingestion background task queued for {upload_id}", flush=True)
    else:
        # Fallback if id cannot be fetched for any reason.
        background_tasks.add_task(compute_and_store_snapshot)
        background_tasks.add_task(compute_observatory_snapshot)
        background_tasks.add_task(refresh_days_open)
        print("[upload] HLES ETL done — fallback background tasks queued", flush=True)
    return {**stats, "uploadId": upload_id}

TRANSLOG_INSERT_BATCH = 500

@router.post("/upload/translog")
async def upload_translog(file: UploadFile = File(...)):
    """Upload TRANSLOG file (CSV or Excel) -> land in Volume -> ETL -> insert into translog_events table."""
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File too large ({len(contents) / 1024 / 1024:.1f} MB). Maximum is 50 MB. "
                "For historical bulk loads, use: python scripts/load_translog_csv.py"
            ),
        )
    landed_path = _land_file_in_volume(
        contents, file.filename or "translog.xlsx", TRANSLOG_LANDING_VOLUME_PATH
    )

    # Detect format: CSV or Excel
    fname = (file.filename or "").lower()
    if fname.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(contents), dtype=str, keep_default_na=False)
    else:
        df = pd.read_excel(io.BytesIO(contents), engine="openpyxl", dtype=str)

    df_clean = clean_translog_data(df)

    stats = {"eventsParsed": len(df), "matched": 0, "orphan": 0, "inserted": 0}
    if landed_path:
        stats["landedPath"] = landed_path

    # Detect if this is raw Databricks format or legacy
    is_raw = "knum" in df_clean.columns or "system_date" in df_clean.columns

    if is_raw:
        stats = _upload_translog_raw(df_clean, stats)
    else:
        stats = _upload_translog_legacy(df_clean, stats)

    return stats


def _upload_translog_raw(df_clean, stats):
    """Insert raw translog events into translog_events table."""
    print(f"[upload] TRANSLOG (raw) processing {len(df_clean)} rows...", flush=True)
    t_start = _time.monotonic()

    # Build knum → lead_id and rez_num → lead_id lookups
    knum_to_lead = {}
    unique_knums = [k for k in df_clean["knum"].dropna().unique() if k]
    unique_rez_nums = [r for r in df_clean["rez_num"].dropna().unique() if r] if "rez_num" in df_clean.columns else []
    with with_connection() as conn:
        with conn.cursor() as cur:
            # Match by knum → leads.knum
            for i in range(0, len(unique_knums), HLES_SELECT_CHUNK):
                chunk = list(unique_knums[i : i + HLES_SELECT_CHUNK])
                if not chunk:
                    continue
                placeholders = ",".join(["%s"] * len(chunk))
                cur.execute(
                    f"SELECT id, knum FROM leads WHERE knum IN ({placeholders})",
                    tuple(chunk),
                )
                for lead in cur.fetchall():
                    if lead["knum"]:
                        knum_to_lead[lead["knum"]] = lead["id"]
            # Match by rez_num → leads.confirm_num (fallback for rows without knum match)
            for i in range(0, len(unique_rez_nums), HLES_SELECT_CHUNK):
                chunk = list(unique_rez_nums[i : i + HLES_SELECT_CHUNK])
                if not chunk:
                    continue
                placeholders = ",".join(["%s"] * len(chunk))
                cur.execute(
                    f"SELECT id, confirm_num FROM leads WHERE confirm_num IN ({placeholders})",
                    tuple(chunk),
                )
                for lead in cur.fetchall():
                    if lead["confirm_num"] and lead["confirm_num"] not in knum_to_lead:
                        knum_to_lead[lead["confirm_num"]] = lead["id"]

    # Build insert rows
    db_cols = [
        "source_id", "lead_id", "knum", "rez_num", "confirm_num", "loc_code",
        "system_date", "application_date", "event_type", "bgn01", "stat_flag",
        "sf_trans", "msg1", "msg2", "msg3", "msg4", "msg5", "msg6", "msg7",
        "msg8", "msg9", "msg10", "emp_code", "emp_lname", "emp_fname",
        "requested_days", "timezone_offset", "load_date", "source_system",
        "source_region",
    ]

    def _val_or_none(row, col):
        v = row.get(col)
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return None
        if isinstance(v, str) and v.strip() in ("", "null"):
            return None
        return v

    rows_to_insert = []
    for _, row in df_clean.iterrows():
        knum = _val_or_none(row, "knum")
        rez_num = _val_or_none(row, "rez_num")
        lead_id = knum_to_lead.get(knum) if knum else None
        if not lead_id and rez_num:
            lead_id = knum_to_lead.get(rez_num)
        if lead_id:
            stats["matched"] += 1
        else:
            stats["orphan"] += 1

        rows_to_insert.append(tuple(_val_or_none(row, col) if col != "lead_id" else lead_id for col in db_cols))

    # Batch insert
    if rows_to_insert:
        placeholders = ",".join(["%s"] * len(db_cols))
        sql = f"INSERT INTO translog_events ({', '.join(db_cols)}) VALUES ({placeholders})"
        with with_connection() as conn:
            with conn.cursor() as cur:
                for i in range(0, len(rows_to_insert), TRANSLOG_INSERT_BATCH):
                    batch = rows_to_insert[i : i + TRANSLOG_INSERT_BATCH]
                    cur.executemany(sql, batch)
            stats["inserted"] = len(rows_to_insert)

    print(f"[upload] TRANSLOG (raw) done in {_time.monotonic() - t_start:.2f}s — {stats['inserted']} inserted", flush=True)
    return stats


def _upload_translog_legacy(df_clean, stats):
    """Legacy path: insert simplified events into translog_events with msg1 as event description."""
    print(f"[upload] TRANSLOG (legacy) processing {len(df_clean)} rows...", flush=True)
    t_start = _time.monotonic()

    rows_events = []
    for _, row in df_clean.iterrows():
        key = _norm_translog_key(row.get("confirm_num") or row.get("reservation_id"))
        if not key:
            stats["orphan"] += 1
            continue
        rows_events.append((key, row))

    if not rows_events:
        return stats

    # Build key → lead_id lookup
    unique_keys = list(dict.fromkeys(k for k, _ in rows_events))
    knum_to_lead = {}
    with with_connection() as conn:
        with conn.cursor() as cur:
            for i in range(0, len(unique_keys), HLES_SELECT_CHUNK):
                chunk = unique_keys[i : i + HLES_SELECT_CHUNK]
                if not chunk:
                    continue
                placeholders = ",".join(["%s"] * len(chunk))
                cur.execute(
                    f"""SELECT id, confirm_num, reservation_id FROM leads
                        WHERE confirm_num IN ({placeholders}) OR reservation_id IN ({placeholders})""",
                    tuple(chunk) + tuple(chunk),
                )
                for lead in cur.fetchall():
                    if lead.get("confirm_num"):
                        knum_to_lead[lead["confirm_num"]] = lead["id"]
                    if lead.get("reservation_id"):
                        knum_to_lead[lead["reservation_id"]] = lead["id"]

    # Insert into translog_events
    insert_rows = []
    for key, row in rows_events:
        lead_id = knum_to_lead.get(key)
        if lead_id:
            stats["matched"] += 1
        else:
            stats["orphan"] += 1

        event_time = row.get("event_time")
        if event_time is not None and not pd.isna(event_time):
            event_time = str(event_time)
        else:
            event_time = None

        insert_rows.append((
            lead_id,
            key,  # knum
            event_time,  # system_date
            None,  # event_type (numeric)
            row.get("event_type", ""),  # msg1 (text description)
            row.get("outcome", ""),  # msg2
        ))

    if insert_rows:
        sql = "INSERT INTO translog_events (lead_id, knum, system_date, event_type, msg1, msg2) VALUES (%s, %s, %s, %s, %s, %s)"
        with with_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(sql, insert_rows)
            stats["inserted"] = len(insert_rows)

    print(f"[upload] TRANSLOG (legacy) done in {_time.monotonic() - t_start:.2f}s — {stats.get('inserted', 0)} inserted", flush=True)
    return stats


@router.post("/upload/refresh-days-open")
def trigger_days_open_refresh():
    """
    Admin endpoint: manually recalculate days_open for all leads from init_dt_final.
    Useful for backfilling historical records without uploading a new HLES file.
    Runs synchronously and returns the count of rows updated.
    """
    result = refresh_days_open()
    return result
