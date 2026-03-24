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

HLES_SELECT_CHUNK = 2000  # used by translog router

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


_INGEST_COLS = [
    "customer", "reservation_id", "status", "branch", "bm_name",
    "insurance_company", "hles_reason", "init_dt_final",
    "confirm_num", "knum", "body_shop", "cdp_name",
    "htz_region", "set_state", "zone", "area_mgr", "general_mgr",
    "rent_loc", "week_of", "contact_range", "first_contact_by", "time_to_first_contact",
]


def _row_to_copy_tuple(row, confirm_num):
    return (
        _val(row, "customer"), confirm_num,
        _val(row, "status"), _val(row, "branch"), _val(row, "bm_name"),
        _val(row, "insurance_company"), _val(row, "hles_reason"), _val(row, "init_dt_final"),
        confirm_num, _val(row, "knum"), _val(row, "body_shop"), _val(row, "cdp_name"),
        _val(row, "htz_region"), _val(row, "set_state"), _val(row, "zone"),
        _val(row, "area_mgr"), _val(row, "general_mgr"), _val(row, "rent_loc"),
        _val(row, "week_of"), _val(row, "contact_range"),
        _val(row, "first_contact_by"), _val(row, "time_to_first_contact"),
    )


def _run_full_ingest(upload_id, rows_to_process, base_stats: dict):
    """Background task: DB upserts (COPY + temp table) + org_mapping + snapshot jobs."""
    print(f"[upload] _run_full_ingest START upload_id={upload_id} rows={len(rows_to_process)}", flush=True)
    stats = dict(base_stats)
    try:
        print(f"[upload] ingest: acquiring DB connection", flush=True)
        with with_connection() as conn:
            with conn.cursor() as cur:
                # 1) COPY all incoming rows into a temp staging table
                cur.execute(f"""
                    CREATE TEMP TABLE _hles_stage (
                        {', '.join(f'{c} TEXT' for c in _INGEST_COLS)}
                    ) ON COMMIT DROP
                """)
                with cur.copy(f"COPY _hles_stage ({','.join(_INGEST_COLS)}) FROM STDIN") as cp:
                    for confirm_num, row in rows_to_process:
                        cp.write_row(_row_to_copy_tuple(row, confirm_num))
                print(f"[upload] COPY stage done", flush=True)

                # 2) INSERT new rows (confirm_num not in leads)
                _DATE_COLS = {"init_dt_final", "week_of"}
                cols_joined = ", ".join(_INGEST_COLS)
                select_cols = ", ".join(
                    f"s.{c}::date" if c in _DATE_COLS else f"s.{c}"
                    for c in _INGEST_COLS
                )
                cur.execute(f"""
                    INSERT INTO leads ({cols_joined})
                    SELECT {select_cols} FROM _hles_stage s
                    WHERE NOT EXISTS (
                        SELECT 1 FROM leads l WHERE l.confirm_num = s.confirm_num
                    )
                """)
                stats["newLeads"] = cur.rowcount
                print(f"[upload] INSERT done: {stats['newLeads']} new leads", flush=True)

                # 3) UPDATE existing rows
                set_cols = [c for c in _INGEST_COLS if c != "confirm_num"]
                set_exprs = ", ".join(
                    f"{c} = s.{c}::date" if c in _DATE_COLS else f"{c} = s.{c}"
                    for c in set_cols
                )
                cur.execute(f"""
                    UPDATE leads SET
                        {set_exprs},
                        archived = false,
                        updated_at = now()
                    FROM _hles_stage s
                    WHERE leads.confirm_num = s.confirm_num
                """)
                stats["updated"] = cur.rowcount
                print(f"[upload] UPDATE done: {stats['updated']} updated", flush=True)

                # 4) Sync org_mapping from HLES
                _upsert_org_mapping_from_hles(rows_to_process, cur)
                print(f"[upload] org_mapping upsert done", flush=True)

        print(f"[upload] ingest complete for {upload_id} — newLeads={stats['newLeads']} updated={stats['updated']}", flush=True)

        # DB writes done — snapshots next
        _set_ingestion_status(upload_id, "rebuilding_snapshots", counts={"newLeads": stats["newLeads"], "updated": stats["updated"], "failed": stats["failed"]})

        # Snapshot + observatory + days_open
        compute_and_store_snapshot()
        compute_observatory_snapshot()
        refresh_days_open()
        _set_ingestion_status(upload_id, "success", counts={"newLeads": stats["newLeads"], "updated": stats["updated"], "failed": stats["failed"]})
        print(f"[upload] post-upload ingestion succeeded for {upload_id}", flush=True)

    except Exception as exc:
        import traceback
        print(f"[upload] full ingest EXCEPTION for {upload_id}: {exc}", flush=True)
        traceback.print_exc()
        try:
            _set_ingestion_status(upload_id, "failed", error=str(exc))
        except Exception as e2:
            print(f"[upload] _set_ingestion_status also failed: {e2}", flush=True)


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
    """Upload HLES Excel file -> parse/validate -> return uploadId immediately -> ETL + snapshots in background."""
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File too large ({len(contents) / 1024 / 1024:.1f} MB). Maximum is 50 MB. "
                "For historical bulk loads, use the admin CLI."
            ),
        )

    # Land raw file in Volume synchronously (fast — local path or Databricks Volume write)
    landed_path = _land_file_in_volume(contents, file.filename or "hles.xlsx", HLES_LANDING_VOLUME_PATH)

    # Parse and clean the Excel file (synchronous, but fast relative to DB work)
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

    # Validate rows — reject bad confirm_nums before queuing background work
    rows_to_process = []
    for _, row in df_clean.iterrows():
        confirm_num = _val(row, "confirm_num")
        if not confirm_num:
            stats["failed"] += 1
            continue
        rows_to_process.append((confirm_num, row.to_dict()))

    if not rows_to_process:
        stats["ingestion_status"] = "failed"
        stats["ingestion_error"] = "No valid rows to ingest."
        stats["ingestion_updated_at"] = datetime.now(_ET).isoformat()
        execute(
            "INSERT INTO upload_summary (hles, translog, data_as_of_date) VALUES (%s::jsonb, %s::jsonb, %s)",
            (json.dumps(stats), "{}", str(pd.Timestamp.now().date())),
        )
        return stats

    # Create upload_summary record immediately so the UI can poll ingestion-status
    inserted = query(
        "INSERT INTO upload_summary (hles, translog, data_as_of_date) VALUES (%s::jsonb, %s::jsonb, %s) RETURNING id",
        (json.dumps(stats), "{}", str(pd.Timestamp.now().date())),
    )
    upload_id = inserted[0]["id"] if inserted else None

    # Queue the full ingest (SELECT / INSERT / UPDATE / org_mapping / snapshot) as a background task.
    # The HTTP response returns immediately with upload_id so the UI can poll /upload/ingestion-status/{id}.
    background_tasks.add_task(_run_full_ingest, upload_id, rows_to_process, stats)
    print(f"[upload] HLES parsed {len(rows_to_process)} rows — background ingest queued for {upload_id}", flush=True)

    return {**stats, "uploadId": upload_id}

@router.post("/upload/translog")
async def upload_translog(file: UploadFile = File(...)):
    """Upload TRANSLOG Excel file -> land in Volume (if configured) -> match events to leads."""
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File too large ({len(contents) / 1024 / 1024:.1f} MB). Maximum is 50 MB. "
                "For historical bulk loads, use the admin CLI."
            ),
        )
    # Land raw file in Unity Catalog Volume (datalabs.lab_lms_prod.translog_landing_prod)
    landed_path = _land_file_in_volume(
        contents, file.filename or "translog.xlsx", TRANSLOG_LANDING_VOLUME_PATH
    )
    df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

    df_clean = clean_translog_data(df)

    stats = {"eventsParsed": len(df), "matched": 0, "orphan": 0}
    if landed_path:
        stats["landedPath"] = landed_path

    rows_events: list[tuple[str, dict]] = []
    for _, row in df_clean.iterrows():
        key = _norm_translog_key(row.get("confirm_num") or row.get("reservation_id"))
        if not key:
            stats["orphan"] += 1
            continue
        rows_events.append(
            (
                key,
                {
                    "time": str(row.get("event_time", "")),
                    "event": row.get("event_type", ""),
                    "outcome": row.get("outcome", ""),
                },
            )
        )

    if not rows_events:
        return stats

    unique_keys = list(dict.fromkeys(k for k, _ in rows_events))
    print(f"[upload] TRANSLOG processing {len(df_clean)} rows...", flush=True)
    t_start = _time.monotonic()

    confirm_map: dict[str, dict] = {}
    res_map: dict[str, dict] = {}
    leads_by_id: dict = {}

    with with_connection() as conn:
        with conn.cursor() as cur:
            for i in range(0, len(unique_keys), HLES_SELECT_CHUNK):
                chunk = unique_keys[i : i + HLES_SELECT_CHUNK]
                if not chunk:
                    continue
                placeholders = ",".join(["%s"] * len(chunk))
                cur.execute(
                    f"""SELECT id, confirm_num, reservation_id, translog FROM leads
                        WHERE confirm_num IN ({placeholders}) OR reservation_id IN ({placeholders})""",
                    tuple(chunk) + tuple(chunk),
                )
                for lead in cur.fetchall():
                    lid = lead["id"]
                    leads_by_id[lid] = lead
                    c = _norm_translog_key(lead.get("confirm_num"))
                    r = _norm_translog_key(lead.get("reservation_id"))
                    if c and c not in confirm_map:
                        confirm_map[c] = lead
                    if r and r not in res_map:
                        res_map[r] = lead

            lead_events = defaultdict(list)
            for key, evt in rows_events:
                lead = confirm_map.get(key) or res_map.get(key)
                if not lead:
                    stats["orphan"] += 1
                    continue
                lead_events[lead["id"]].append(evt)
                stats["matched"] += 1

            for lead_id, new_events in lead_events.items():
                lead = leads_by_id[lead_id]
                current_log = list(lead.get("translog") or [])
                current_log.extend(new_events)
                cur.execute(
                    """UPDATE leads SET
                        translog = %s::jsonb,
                        last_activity = now(),
                        updated_at = now()
                    WHERE id = %s""",
                    (json.dumps(current_log), lead_id),
                )

    print(f"[upload] TRANSLOG done in {_time.monotonic() - t_start:.2f}s", flush=True)

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
