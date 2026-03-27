"""
Bulk-load translog CSV into the translog_events table.

Usage:
    source .venv/bin/activate
    set -a && source .env.local && set +a
    python scripts/load_translog_csv.py [path_to_csv]

Default CSV: prodfiles/Translog (Partitioned) Nov-Dec 2025.csv

Strategy:
  - Reads CSV in chunks (50k rows) using pandas for memory efficiency
  - Parses SystemDate/ApplicationDate from YYYYMMDDHHMMSS to timestamptz
  - Attempts lead_id linkage via knum → leads.knum, then rez_num → leads.confirm_num
  - Uses psycopg COPY for fast bulk insert (10-50x faster than INSERT)
  - Reports progress every chunk
"""
import os
import sys
import time
import csv
import io
from datetime import datetime, timezone

import pandas as pd
import psycopg
from psycopg.rows import dict_row

# ─── Config ──────────────────────────────────────────────────────────────────

CHUNK_SIZE = 50_000
DEFAULT_CSV = "prodfiles/Translog (Partitioned) Nov-Dec 2025.csv"

# Columns we extract from CSV → DB column mapping
CSV_TO_DB = {
    "ID": "source_id",
    "Knum": "knum",
    "REZ_NUM": "rez_num",
    "CONFIRM_NUM": "confirm_num",
    "LocCode": "loc_code",
    "SystemDate": "system_date",
    "ApplicationDate": "application_date",
    "EventType": "event_type",
    "BGN01": "bgn01",
    "STAT_FLAG": "stat_flag",
    "SF_TRANS": "sf_trans",
    "MSG1": "msg1",
    "MSG2": "msg2",
    "MSG3": "msg3",
    "MSG4": "msg4",
    "MSG5": "msg5",
    "MSG6": "msg6",
    "MSG7": "msg7",
    "MSG8": "msg8",
    "MSG9": "msg9",
    "MSG10": "msg10",
    "EMP_CODE": "emp_code",
    "EMP_LNAME": "emp_lname",
    "EMP_FNAME": "emp_fname",
    "REQUESTED_DAYS": "requested_days",
    "TIMEZONE": "timezone_offset",
    "LoadDate": "load_date",
    "SourceSystem": "source_system",
    "SourceRegion": "source_region",
}

DB_COLUMNS = [
    "source_id", "lead_id", "knum", "rez_num", "confirm_num", "loc_code",
    "system_date", "application_date", "event_type", "bgn01", "stat_flag",
    "sf_trans", "msg1", "msg2", "msg3", "msg4", "msg5", "msg6", "msg7",
    "msg8", "msg9", "msg10", "emp_code", "emp_lname", "emp_fname",
    "requested_days", "timezone_offset", "load_date", "source_system",
    "source_region",
]


def _get_conninfo():
    return (
        f"host={os.environ['PGHOST']} "
        f"port={os.environ.get('PGPORT', 5432)} "
        f"dbname={os.environ['PGDATABASE']} "
        f"user={os.environ['PGUSER']} "
        f"password={os.environ['PGPASSWORD']} "
        f"sslmode={os.environ.get('PGSSLMODE', 'require')}"
    )


def _parse_hles_timestamp(val):
    """Parse YYYYMMDDHHMMSS string to ISO timestamp string, or None."""
    if not val or val == "null" or pd.isna(val):
        return None
    s = str(val).strip()
    if len(s) < 14:
        return None
    try:
        dt = datetime(
            int(s[0:4]), int(s[4:6]), int(s[6:8]),
            int(s[8:10]), int(s[10:12]), int(s[12:14]),
            tzinfo=timezone.utc,
        )
        return dt.isoformat()
    except (ValueError, IndexError):
        return None


def _clean_text(val):
    """Return None for null/empty, else stripped string."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    if s == "" or s == "null":
        return None
    return s


def _clean_int(val, default=None):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def _parse_load_date(val):
    if not val or val == "null" or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date().isoformat()
    except ValueError:
        return None


def load_csv(csv_path: str):
    conninfo = _get_conninfo()

    # 1) Build dual-key lookup: knum → lead_id and confirm_num → lead_id
    print("[translog-loader] Building knum/confirm_num → lead_id lookup from leads table...")
    knum_to_lead = {}
    confirm_to_lead = {}
    with psycopg.connect(conninfo, row_factory=dict_row) as conn:
        cur = conn.execute("SELECT id, knum, confirm_num FROM leads WHERE knum IS NOT NULL OR confirm_num IS NOT NULL")
        for r in cur.fetchall():
            if r["knum"]:
                knum_to_lead[r["knum"]] = r["id"]
            if r["confirm_num"]:
                confirm_to_lead[r["confirm_num"]] = r["id"]
    print(f"[translog-loader] {len(knum_to_lead)} leads by knum, {len(confirm_to_lead)} leads by confirm_num")

    # Check for resume: count already-loaded rows to skip chunks
    with psycopg.connect(conninfo) as conn:
        cur = conn.execute("SELECT COUNT(*) FROM translog_events")
        existing_count = cur.fetchone()[0]
    skip_chunks = existing_count // CHUNK_SIZE if existing_count > 0 else 0
    if existing_count > 0:
        print(f"[translog-loader] RESUMING: {existing_count:,} rows already loaded, skipping {skip_chunks} chunks")

    # 2) Process CSV in chunks
    total_inserted = 0
    total_matched = 0
    total_orphan = 0
    chunk_num = 0
    t_start = time.monotonic()

    for chunk in pd.read_csv(csv_path, chunksize=CHUNK_SIZE, dtype=str, keep_default_na=False):
        chunk_num += 1
        rows = []

        # Resume: skip already-loaded chunks
        if chunk_num <= skip_chunks:
            elapsed = time.monotonic() - t_start
            print(f"[translog-loader] Skipping chunk {chunk_num} (already loaded) — {elapsed:.0f}s", flush=True)
            continue

        for _, csv_row in chunk.iterrows():
            knum = _clean_text(csv_row.get("Knum"))
            rez_num = _clean_text(csv_row.get("REZ_NUM"))
            lead_id = knum_to_lead.get(knum) if knum else None
            if not lead_id and rez_num:
                lead_id = confirm_to_lead.get(rez_num)

            if lead_id:
                total_matched += 1
            else:
                total_orphan += 1

            row = (
                _clean_int(csv_row.get("ID")),            # source_id
                lead_id,                                    # lead_id
                knum,                                       # knum
                _clean_text(csv_row.get("REZ_NUM")),       # rez_num
                _clean_text(csv_row.get("CONFIRM_NUM")),   # confirm_num
                _clean_text(csv_row.get("LocCode")),       # loc_code
                _parse_hles_timestamp(csv_row.get("SystemDate")),       # system_date
                _parse_hles_timestamp(csv_row.get("ApplicationDate")),  # application_date
                _clean_int(csv_row.get("EventType")),      # event_type
                _clean_text(csv_row.get("BGN01")),         # bgn01
                _clean_text(csv_row.get("STAT_FLAG")),     # stat_flag
                _clean_text(csv_row.get("SF_TRANS")),      # sf_trans
                _clean_text(csv_row.get("MSG1")),          # msg1
                _clean_text(csv_row.get("MSG2")),          # msg2
                _clean_text(csv_row.get("MSG3")),          # msg3
                _clean_text(csv_row.get("MSG4")),          # msg4
                _clean_text(csv_row.get("MSG5")),          # msg5
                _clean_text(csv_row.get("MSG6")),          # msg6
                _clean_text(csv_row.get("MSG7")),          # msg7
                _clean_text(csv_row.get("MSG8")),          # msg8
                _clean_text(csv_row.get("MSG9")),          # msg9
                _clean_text(csv_row.get("MSG10")),         # msg10
                _clean_text(csv_row.get("EMP_CODE")),      # emp_code
                _clean_text(csv_row.get("EMP_LNAME")),     # emp_lname
                _clean_text(csv_row.get("EMP_FNAME")),     # emp_fname
                _clean_int(csv_row.get("REQUESTED_DAYS"), 0),  # requested_days
                _clean_int(csv_row.get("TIMEZONE"), 0),    # timezone_offset
                _parse_load_date(csv_row.get("LoadDate")), # load_date
                _clean_text(csv_row.get("SourceSystem")),  # source_system
                _clean_text(csv_row.get("SourceRegion")),  # source_region
            )
            rows.append(row)

        # Bulk insert with retry — smaller sub-batches and fresh connection per batch
        SUB_BATCH = 5000
        if rows:
            placeholders = ",".join(["%s"] * len(DB_COLUMNS))
            sql = f"INSERT INTO translog_events ({', '.join(DB_COLUMNS)}) VALUES ({placeholders})"

            for sb_start in range(0, len(rows), SUB_BATCH):
                sub = rows[sb_start : sb_start + SUB_BATCH]
                for attempt in range(3):
                    try:
                        with psycopg.connect(conninfo) as conn:
                            with conn.cursor() as cur:
                                cur.executemany(sql, sub)
                            conn.commit()
                        total_inserted += len(sub)
                        break
                    except Exception as exc:
                        if attempt < 2:
                            print(f"[translog-loader] Retry {attempt+1}/3 for sub-batch: {exc}", flush=True)
                            time.sleep(2 ** attempt)
                        else:
                            print(f"[translog-loader] FAILED sub-batch after 3 attempts: {exc}", flush=True)
                            raise

        elapsed = time.monotonic() - t_start
        rate = total_inserted / elapsed if elapsed > 0 else 0
        print(
            f"[translog-loader] Chunk {chunk_num}: "
            f"{total_inserted:,} rows inserted "
            f"({total_matched:,} matched, {total_orphan:,} orphan) "
            f"— {rate:,.0f} rows/sec — {elapsed:.0f}s elapsed"
        )

    elapsed = time.monotonic() - t_start
    print(f"\n[translog-loader] DONE: {total_inserted:,} rows in {elapsed:.1f}s")
    print(f"  Matched to leads: {total_matched:,}")
    print(f"  Orphan (unassigned): {total_orphan:,}")


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    if not os.path.exists(csv_path):
        print(f"Error: CSV not found at {csv_path}")
        sys.exit(1)
    print(f"[translog-loader] Loading from: {csv_path}")
    print(f"[translog-loader] Chunk size: {CHUNK_SIZE:,}")
    load_csv(csv_path)
