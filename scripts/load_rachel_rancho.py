"""
Load leads and translog data for:
  - general_mgr = RACHEL MESSINGER
  - rent_loc    = 7109-04    - RANCHO HLE

from the Nov-Dec 2025 production files into Neon DB.

Usage:
    source .venv/bin/activate
    set -a && source .env.local && set +a
    python scripts/load_rachel_rancho.py           # dry-run
    python scripts/load_rachel_rancho.py --apply   # write to DB
"""
import argparse
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from db import query, with_connection
from etl.clean import clean_hles_data

# ─── File paths ───────────────────────────────────────────────────────────────
HLES_FILE = Path(__file__).parent.parent / "prodfiles" / "Conversion Data Nov-Dec 2025 (1).xlsx"
TRANSLOG_CSV = Path(__file__).parent.parent / "prodfiles" / "Translog (Partitioned) Nov-Dec 2025.csv"

# ─── Filter criteria ──────────────────────────────────────────────────────────
TARGET_GM = "RACHEL MESSINGER"
TARGET_RENT_LOC = "7109-04    - RANCHO HLE"

# ─── Batch sizes ──────────────────────────────────────────────────────────────
SELECT_CHUNK = 2000
INSERT_BATCH = 500
UPDATE_BATCH = 500
TRANSLOG_CHUNK = 50_000
TRANSLOG_SUB_BATCH = 5000

# ─── Translog DB columns ─────────────────────────────────────────────────────
TRANSLOG_DB_COLUMNS = [
    "source_id", "lead_id", "knum", "rez_num", "confirm_num", "loc_code",
    "system_date", "application_date", "event_type", "bgn01", "stat_flag",
    "sf_trans", "msg1", "msg2", "msg3", "msg4", "msg5", "msg6", "msg7",
    "msg8", "msg9", "msg10", "emp_code", "emp_lname", "emp_fname",
    "requested_days", "timezone_offset", "load_date", "source_system",
    "source_region",
]


def _val(row, col):
    v = row.get(col)
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v


def _row_to_insert_tuple(row, confirm_num):
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
    )


def _row_to_update_tuple(row, confirm_num):
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
    )


def _build_org_lookup() -> dict:
    rows = query("SELECT branch, bm FROM org_mapping")
    return {r["branch"]: r["bm"] for r in rows} if rows else {}


# ─── Translog helpers (from load_translog_csv.py) ────────────────────────────

def _parse_hles_timestamp(val):
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


def _build_translog_row(csv_row, knum, lead_id):
    return (
        _clean_int(csv_row.get("ID")),
        lead_id,
        knum,
        _clean_text(csv_row.get("REZ_NUM")),
        _clean_text(csv_row.get("CONFIRM_NUM")),
        _clean_text(csv_row.get("LocCode")),
        _parse_hles_timestamp(csv_row.get("SystemDate")),
        _parse_hles_timestamp(csv_row.get("ApplicationDate")),
        _clean_int(csv_row.get("EventType")),
        _clean_text(csv_row.get("BGN01")),
        _clean_text(csv_row.get("STAT_FLAG")),
        _clean_text(csv_row.get("SF_TRANS")),
        _clean_text(csv_row.get("MSG1")),
        _clean_text(csv_row.get("MSG2")),
        _clean_text(csv_row.get("MSG3")),
        _clean_text(csv_row.get("MSG4")),
        _clean_text(csv_row.get("MSG5")),
        _clean_text(csv_row.get("MSG6")),
        _clean_text(csv_row.get("MSG7")),
        _clean_text(csv_row.get("MSG8")),
        _clean_text(csv_row.get("MSG9")),
        _clean_text(csv_row.get("MSG10")),
        _clean_text(csv_row.get("EMP_CODE")),
        _clean_text(csv_row.get("EMP_LNAME")),
        _clean_text(csv_row.get("EMP_FNAME")),
        _clean_int(csv_row.get("REQUESTED_DAYS"), 0),
        _clean_int(csv_row.get("TIMEZONE"), 0),
        _parse_load_date(csv_row.get("LoadDate")),
        _clean_text(csv_row.get("SourceSystem")),
        _clean_text(csv_row.get("SourceRegion")),
    )


# ─── STEP 1: Load leads ──────────────────────────────────────────────────────

def load_leads(apply: bool) -> set:
    """Load filtered leads from HLES Excel. Returns set of knum values for translog matching."""
    print(f"\n{'='*60}")
    print(f"STEP 1: LOAD LEADS")
    print(f"{'='*60}")
    print(f"[leads] Reading {HLES_FILE.name} ...", flush=True)

    df_raw = pd.read_excel(HLES_FILE, engine="openpyxl")
    print(f"[leads] {len(df_raw)} total raw rows", flush=True)

    # Pre-filter by GENERAL_MGR and RENT_LOC before ETL clean
    # Column names in raw Excel have leading newlines
    gm_col = None
    rl_col = None
    for c in df_raw.columns:
        if c.strip().upper().replace(" ", "_") == "GENERAL_MGR":
            gm_col = c
        if c.strip().upper().replace(" ", "_") == "RENT_LOC":
            rl_col = c

    if gm_col is None or rl_col is None:
        print(f"[leads] ERROR: Could not find GENERAL_MGR ({gm_col}) or RENT_LOC ({rl_col}) columns")
        print(f"[leads] Available columns: {list(df_raw.columns)}")
        return set()

    # Filter: GM = RACHEL MESSINGER AND RENT_LOC = 7109-04    - RANCHO HLE
    mask = (
        df_raw[gm_col].astype(str).str.strip().str.upper() == TARGET_GM.upper()
    ) & (
        df_raw[rl_col].astype(str).str.strip() == TARGET_RENT_LOC
    )
    df_filtered = df_raw[mask].copy()
    print(f"[leads] {len(df_filtered)} rows match GM={TARGET_GM}, RENT_LOC={TARGET_RENT_LOC}", flush=True)

    if len(df_filtered) == 0:
        print("[leads] No matching leads found. Aborting.")
        return set()

    # Drop old contact_group if new_contact_group exists (both rename to same target
    # causing duplicate columns). Normalize names first to detect.
    norm_cols = {c.strip().lower().replace(" ", "_"): c for c in df_filtered.columns}
    if "contact_group" in norm_cols and "new_contact_group" in norm_cols:
        df_filtered = df_filtered.drop(columns=[norm_cols["contact_group"]])

    # Apply ETL cleaning
    org_lookup = _build_org_lookup()
    df_clean = clean_hles_data(df_filtered, org_lookup)
    print(f"[leads] {len(df_clean)} rows after ETL clean", flush=True)

    rows_to_process = []
    knum_set = set()
    for _, row in df_clean.iterrows():
        confirm_num = _val(row, "confirm_num")
        if not confirm_num:
            continue
        rows_to_process.append((confirm_num, row))
        knum = _val(row, "knum")
        if knum:
            knum_set.add(str(knum).strip())

    print(f"[leads] {len(rows_to_process)} rows with valid confirm_num", flush=True)
    print(f"[leads] {len(knum_set)} unique knum values for translog matching", flush=True)

    # Determine insert vs update
    confirm_nums = [c for c, _ in rows_to_process]
    existing = set()
    for i in range(0, len(confirm_nums), SELECT_CHUNK):
        chunk = confirm_nums[i:i + SELECT_CHUNK]
        placeholders = ",".join(["%s"] * len(chunk))
        rows_db = query(
            f"SELECT confirm_num FROM leads WHERE confirm_num IN ({placeholders})",
            tuple(chunk),
        )
        for r in rows_db:
            existing.add(r["confirm_num"])

    to_insert = [(c, r) for c, r in rows_to_process if c not in existing]
    to_update = [(c, r) for c, r in rows_to_process if c in existing]
    print(f"[leads] {len(to_insert)} new → INSERT, {len(to_update)} existing → UPDATE", flush=True)

    # Show status breakdown
    statuses = {}
    for _, row in rows_to_process:
        s = _val(row, "status") or "Unknown"
        statuses[s] = statuses.get(s, 0) + 1
    print(f"[leads] Status breakdown: {statuses}", flush=True)

    if not apply:
        print("[leads] DRY RUN — no changes written.", flush=True)
        return knum_set

    # Execute INSERT + UPDATE
    cols = (
        "customer, reservation_id, status, branch, bm_name, insurance_company, hles_reason, init_dt_final, "
        "confirm_num, knum, body_shop, cdp_name, htz_region, set_state, zone, area_mgr, general_mgr, rent_loc, "
        "week_of, contact_range, first_contact_by, time_to_first_contact"
    )
    insert_one = "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
    update_one = "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"

    inserted_count = 0
    updated_count = 0

    with with_connection() as conn:
        with conn.cursor() as cur:
            # INSERT new rows
            for i in range(0, len(to_insert), INSERT_BATCH):
                batch = to_insert[i:i + INSERT_BATCH]
                tuples = [_row_to_insert_tuple(r, c) for c, r in batch]
                placeholders = ",".join([insert_one] * len(tuples))
                sql = f"INSERT INTO leads ({cols}) VALUES {placeholders}"
                cur.execute(sql, tuple(x for t in tuples for x in t))
                inserted_count += len(batch)
                print(f"  [leads] inserted batch {i // INSERT_BATCH + 1}: {len(batch)} rows", flush=True)

            # UPDATE existing rows
            for i in range(0, len(to_update), UPDATE_BATCH):
                batch = to_update[i:i + UPDATE_BATCH]
                tuples = [_row_to_update_tuple(r, c) for c, r in batch]
                placeholders = ",".join([update_one] * len(tuples))
                sql = f"""UPDATE leads SET
                    customer = v.customer, status = v.status, branch = v.branch, bm_name = v.bm_name,
                    insurance_company = v.insurance_company, hles_reason = v.hles_reason,
                    init_dt_final = v.init_dt_final, confirm_num = v.confirm_num,
                    reservation_id = v.reservation_id, knum = v.knum, body_shop = v.body_shop,
                    cdp_name = v.cdp_name, htz_region = v.htz_region, set_state = v.set_state,
                    zone = v.zone, area_mgr = v.area_mgr, general_mgr = v.general_mgr,
                    rent_loc = v.rent_loc, week_of = v.week_of, contact_range = v.contact_range,
                    first_contact_by = v.first_contact_by,
                    time_to_first_contact = v.time_to_first_contact,
                    archived = false, updated_at = now()
                FROM (VALUES {placeholders}) AS v(
                    confirm_num, customer, status, branch, bm_name, insurance_company, hles_reason,
                    init_dt_final, confirm_num2, reservation_id, knum, body_shop, cdp_name,
                    htz_region, set_state, zone, area_mgr, general_mgr, rent_loc,
                    week_of, contact_range, first_contact_by, time_to_first_contact
                )
                WHERE leads.confirm_num = v.confirm_num"""
                cur.execute(sql, tuple(x for t in tuples for x in t))
                updated_count += len(batch)
                print(f"  [leads] updated batch {i // UPDATE_BATCH + 1}: {len(batch)} rows", flush=True)

            # Upsert org_mapping for this branch
            for _, row in rows_to_process:
                branch = _val(row, "branch")
                if branch:
                    cur.execute(
                        """INSERT INTO org_mapping (bm, branch, am, gm, zone)
                           VALUES (%s, %s, %s, %s, %s)
                           ON CONFLICT (branch) DO UPDATE SET
                             bm = EXCLUDED.bm, am = EXCLUDED.am,
                             gm = EXCLUDED.gm, zone = EXCLUDED.zone,
                             updated_at = now()""",
                        (
                            _val(row, "bm_name") or "",
                            branch,
                            _val(row, "area_mgr") or "",
                            _val(row, "general_mgr") or "",
                            _val(row, "zone") or "",
                        ),
                    )
                    break  # Only need to do this once per branch

    print(f"[leads] Done: {inserted_count} inserted, {updated_count} updated", flush=True)
    return knum_set


# ─── STEP 2: Load translog ───────────────────────────────────────────────────

def load_translog(knum_set: set, apply: bool):
    """Load translog events matching the given knum set from the CSV."""
    print(f"\n{'='*60}")
    print(f"STEP 2: LOAD TRANSLOG EVENTS")
    print(f"{'='*60}")

    if not knum_set:
        print("[translog] No knum values to match — skipping translog.", flush=True)
        return

    print(f"[translog] Filtering CSV for {len(knum_set)} knum values ...", flush=True)
    print(f"[translog] Reading from: {TRANSLOG_CSV.name}", flush=True)

    # Build knum → lead_id lookup from leads table (only our target leads)
    placeholders = ",".join(["%s"] * len(knum_set))
    lead_rows = query(
        f"SELECT id, knum, confirm_num FROM leads WHERE knum IN ({placeholders}) OR confirm_num IN ({placeholders})",
        tuple(knum_set) + tuple(knum_set),
    )
    knum_to_lead = {}
    confirm_to_lead = {}
    if lead_rows:
        for r in lead_rows:
            if r["knum"]:
                knum_to_lead[r["knum"]] = r["id"]
            if r["confirm_num"]:
                confirm_to_lead[r["confirm_num"]] = r["id"]
    print(f"[translog] {len(knum_to_lead)} leads found in DB for knum linkage", flush=True)

    # Check how many translog events already exist for these knums
    existing_rows = query(
        f"SELECT COUNT(*)::int AS n FROM translog_events WHERE knum IN ({placeholders})",
        tuple(knum_set),
    )
    existing_count = existing_rows[0]["n"] if existing_rows else 0
    print(f"[translog] {existing_count} translog events already in DB for these knums", flush=True)

    # Read CSV in chunks, filter to matching knums
    total_scanned = 0
    total_matched = 0
    matched_rows = []
    t_start = time.monotonic()

    for chunk_num, chunk in enumerate(
        pd.read_csv(TRANSLOG_CSV, chunksize=TRANSLOG_CHUNK, dtype=str, keep_default_na=False), 1
    ):
        total_scanned += len(chunk)

        # Filter to matching knum values
        if "Knum" in chunk.columns:
            mask = chunk["Knum"].str.strip().isin(knum_set)
            matches = chunk[mask]
        else:
            print(f"[translog] WARNING: No 'Knum' column in chunk {chunk_num}")
            continue

        for _, csv_row in matches.iterrows():
            knum = _clean_text(csv_row.get("Knum"))
            rez_num = _clean_text(csv_row.get("REZ_NUM"))
            lead_id = knum_to_lead.get(knum) if knum else None
            if not lead_id and rez_num:
                lead_id = confirm_to_lead.get(rez_num)
            matched_rows.append(_build_translog_row(csv_row, knum, lead_id))
            total_matched += 1

        elapsed = time.monotonic() - t_start
        print(
            f"  [translog] Chunk {chunk_num}: scanned {total_scanned:,}, "
            f"matched {total_matched:,} — {elapsed:.0f}s",
            flush=True,
        )

    print(f"[translog] Total: {total_matched:,} matching translog rows from {total_scanned:,} scanned", flush=True)

    if total_matched == 0:
        print("[translog] No matching translog events found.", flush=True)
        return

    if not apply:
        print("[translog] DRY RUN — no changes written.", flush=True)
        return

    # Delete existing translog events for these knums to avoid duplicates, then re-insert
    if existing_count > 0:
        print(f"[translog] Deleting {existing_count} existing translog events for these knums ...", flush=True)
        query(
            f"DELETE FROM translog_events WHERE knum IN ({placeholders})",
            tuple(knum_set),
        )
        print(f"[translog] Deleted.", flush=True)

    # Bulk insert
    inserted = 0
    col_str = ", ".join(TRANSLOG_DB_COLUMNS)
    ph = ",".join(["%s"] * len(TRANSLOG_DB_COLUMNS))
    sql = f"INSERT INTO translog_events ({col_str}) VALUES ({ph})"

    import psycopg
    import os

    conninfo = (
        f"host={os.environ['PGHOST']} "
        f"port={os.environ.get('PGPORT', 5432)} "
        f"dbname={os.environ['PGDATABASE']} "
        f"user={os.environ['PGUSER']} "
        f"password={os.environ['PGPASSWORD']} "
        f"sslmode={os.environ.get('PGSSLMODE', 'require')}"
    )

    for sb_start in range(0, len(matched_rows), TRANSLOG_SUB_BATCH):
        sub = matched_rows[sb_start:sb_start + TRANSLOG_SUB_BATCH]
        for attempt in range(3):
            try:
                with psycopg.connect(conninfo) as conn:
                    with conn.cursor() as cur:
                        cur.executemany(sql, sub)
                    conn.commit()
                inserted += len(sub)
                break
            except Exception as exc:
                if attempt < 2:
                    print(f"  [translog] Retry {attempt + 1}/3: {exc}", flush=True)
                    time.sleep(2 ** attempt)
                else:
                    raise
        print(f"  [translog] Inserted {inserted:,}/{len(matched_rows):,}", flush=True)

    print(f"[translog] Done: {inserted:,} translog events inserted", flush=True)


# ─── STEP 3: Post-processing ─────────────────────────────────────────────────

def post_process():
    print(f"\n{'='*60}")
    print(f"STEP 3: POST-PROCESSING")
    print(f"{'='*60}")

    print("[post] Refreshing days_open ...", flush=True)
    from services.days_open import refresh_days_open
    refresh_days_open()

    print("[post] Recomputing snapshots ...", flush=True)
    from services.snapshot import compute_and_store_snapshot
    compute_and_store_snapshot()

    print("[post] Recomputing observatory snapshot ...", flush=True)
    from services.observatory_snapshot import compute_observatory_snapshot
    compute_observatory_snapshot()

    print("[post] Re-linking orphan translog events ...", flush=True)
    relinked = query("""
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
    count = relinked[0]["cnt"] if relinked else 0
    if count > 0:
        print(f"[post] Re-linked {count} orphan translog events", flush=True)

    print("[post] Done.", flush=True)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description=f"Load leads + translog for {TARGET_GM} / {TARGET_RENT_LOC}"
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to DB (default: dry run)")
    args = parser.parse_args()

    print(f"Target GM:       {TARGET_GM}")
    print(f"Target RENT_LOC: {TARGET_RENT_LOC}")
    print(f"Mode:            {'APPLY' if args.apply else 'DRY RUN'}")

    knum_set = load_leads(apply=args.apply)
    load_translog(knum_set, apply=args.apply)

    if args.apply:
        post_process()

    print(f"\n{'='*60}")
    print("ALL DONE")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
