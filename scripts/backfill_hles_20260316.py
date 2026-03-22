"""
Backfill script: ingest prodfiles/All IR Detail 2026.03.16 (1).xlsx into the DB
using the same ETL pipeline as the /upload/hles endpoint, then recompute snapshots.

Usage:
    python scripts/backfill_hles_20260316.py           # dry-run (no DB writes)
    python scripts/backfill_hles_20260316.py --apply   # write to DB + recompute snapshots

Requires the same env vars as the API server (APP_ENV, PGHOST, etc.).
Load them first:
    export $(grep -v '^#' .env.local | xargs) && python scripts/backfill_hles_20260316.py --apply
"""

import argparse
from pathlib import Path

import pandas as pd

from db import query, with_connection
from etl.clean import clean_hles_data

HLES_FILE = Path(__file__).parent.parent / "prodfiles" / "All IR Detail 2026.03.16 (1).xlsx"

SELECT_CHUNK = 2000
INSERT_BATCH = 500
UPDATE_BATCH = 500


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


def run(apply: bool):
    print(f"[backfill] Reading {HLES_FILE.name} ...", flush=True)
    df_raw = pd.read_excel(HLES_FILE, engine="openpyxl")
    print(f"[backfill] {len(df_raw)} raw rows read", flush=True)

    org_lookup = _build_org_lookup()
    df = clean_hles_data(df_raw, org_lookup)
    print(f"[backfill] {len(df)} rows after ETL clean", flush=True)

    rows_to_process = []
    for _, row in df.iterrows():
        confirm_num = _val(row, "confirm_num")
        if not confirm_num:
            continue
        rows_to_process.append((confirm_num, row))
    print(f"[backfill] {len(rows_to_process)} rows with valid confirm_num", flush=True)

    # Determine insert vs update
    confirm_nums = [c for c, _ in rows_to_process]
    existing = set()
    for i in range(0, len(confirm_nums), SELECT_CHUNK):
        chunk = confirm_nums[i: i + SELECT_CHUNK]
        placeholders = ",".join(["%s"] * len(chunk))
        rows_db = query(
            f"SELECT confirm_num FROM leads WHERE confirm_num IN ({placeholders})",
            tuple(chunk),
        )
        for r in rows_db:
            existing.add(r["confirm_num"])

    to_insert = [(c, r) for c, r in rows_to_process if c not in existing]
    to_update = [(c, r) for c, r in rows_to_process if c in existing]
    print(f"[backfill] {len(to_insert)} new leads to INSERT, {len(to_update)} existing to UPDATE", flush=True)

    # Preview week_of corrections for the 7 known affected leads
    print("\n[backfill] Checking week_of values for Sat/Sun leads in Mar-9 week ...", flush=True)
    affected = [
        (c, _val(r, "week_of"), _val(r, "init_dt_final"))
        for c, r in to_update
        if str(_val(r, "week_of") or "") == "2026-03-09"
        and str(_val(r, "init_dt_final") or "") in ("2026-03-07", "2026-03-08")
    ]
    if affected:
        print(f"  {len(affected)} leads will have week_of corrected to 2026-03-09:")
        for c, wk, dt in affected:
            print(f"    confirm_num={c}  init_dt_final={dt}  new week_of={wk}")
    else:
        print("  No Sat/Sun Mar-9 week leads found in update set (may already be correct or not in file)")

    if not apply:
        print("\n[backfill] DRY RUN — no changes written. Pass --apply to execute.", flush=True)
        return

    # Execute upsert
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
                batch = to_insert[i: i + INSERT_BATCH]
                tuples = [_row_to_insert_tuple(r, c) for c, r in batch]
                placeholders = ",".join([insert_one] * len(tuples))
                sql = f"INSERT INTO leads ({cols}) VALUES {placeholders}"
                cur.execute(sql, tuple(x for t in tuples for x in t))
                inserted_count += len(batch)
                print(f"  inserted batch {i // INSERT_BATCH + 1}: {len(batch)} rows", flush=True)

            # UPDATE existing rows
            for i in range(0, len(to_update), UPDATE_BATCH):
                batch = to_update[i: i + UPDATE_BATCH]
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
                    updated_at = now()
                FROM (VALUES {placeholders}) AS v(
                    confirm_num, customer, status, branch, bm_name, insurance_company, hles_reason,
                    init_dt_final, confirm_num2, reservation_id, knum, body_shop, cdp_name,
                    htz_region, set_state, zone, area_mgr, general_mgr, rent_loc,
                    week_of, contact_range, first_contact_by, time_to_first_contact
                )
                WHERE leads.confirm_num = v.confirm_num"""
                cur.execute(sql, tuple(x for t in tuples for x in t))
                updated_count += len(batch)
                print(f"  updated batch {i // UPDATE_BATCH + 1}: {len(batch)} rows", flush=True)

    print(f"\n[backfill] Done: {inserted_count} inserted, {updated_count} updated", flush=True)

    # Recompute snapshots
    print("[backfill] Recomputing snapshots ...", flush=True)
    from services.snapshot import compute_and_store_snapshot
    from services.observatory_snapshot import compute_observatory_snapshot
    from services.days_open import refresh_days_open

    compute_and_store_snapshot()
    compute_observatory_snapshot()
    refresh_days_open()
    print("[backfill] Snapshots recomputed. Done.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill HLES 2026-03-16 file into leads table")
    parser.add_argument("--apply", action="store_true", help="Write changes to DB (default: dry run)")
    args = parser.parse_args()
    run(apply=args.apply)
