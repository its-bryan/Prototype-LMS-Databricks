import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from db import query, with_connection
from etl.clean import clean_hles_data
from services.days_open import refresh_days_open
from services.observatory_snapshot import compute_observatory_snapshot
from services.snapshot import compute_and_store_snapshot


AUTH_SEED_ROWS = [
    (
        "admin.leo@hertz.com",
        "$2b$12$NDgnCzjE4sdutqA7RkKB2u0VcGjLxfPBOBBLyxDT25Q6jQpolwSgi",
        "admin",
        "Leo Admin",
        None,
    ),
    (
        "adamfrankel.leo@hertz.com",
        "$2b$12$RqJxDvUBuBSR2iFw.eGRCOPlZ2CYTdGDY0YcrvohqFtKkuGsBqQGO",
        "gm",
        "Adam Frankel",
        None,
    ),
    (
        "jonathanhoover.leo@hertz.com",
        "$2b$12$0OkbnzdIlM3K0HmGunSuteOl8HLVkyPW4cF1yd.yiJ.ceQVP0rKNe",
        "bm",
        "Jonathan Hoover",
        "7467-09 - DORAL HLE",
    ),
    (
        "jeri.leo@hertz.com",
        "$2b$12$drITSEAjqJTwE0W0qgmlYuUIgycvOZQUNkykpJb44VRtsOLYT6/Y2",
        "bm",
        "Jeri Baumwoll",
        "7109-04    - RANCHO HLE",
    ),
    (
        "rachel.leo@hertz.com",
        "$2b$12$YlNVpD4QFQ102fbznP1xo.PWd4wa7FUEcvvlPVY5HjW6fx1vx3UCK",
        "gm",
        "Rachel Messinger",
        None,
    ),
]


def _val(row, col):
    value = row.get(col)
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if pd.isna(value):
        return None
    return value


def _build_org_lookup() -> dict:
    rows = query("SELECT branch, bm FROM org_mapping")
    return {r["branch"]: r["bm"] for r in rows} if rows else {}


def seed_config_tables() -> None:
    cancel_rows = query("SELECT COUNT(*)::int AS n FROM cancellation_reason_categories")
    if (cancel_rows[0]["n"] if cancel_rows else 0) == 0:
        query(
            """
            INSERT INTO cancellation_reason_categories (category, reasons, sort_order) VALUES
              ('Customer Unreachable', '["Unable to reach — no answer after multiple attempts","Invalid or disconnected phone number","Customer requested callback — never answered"]'::jsonb, 1),
              ('Customer Decision', '["Found better rate elsewhere","Changed travel plans","Decided not to rent","Rented from competitor"]'::jsonb, 2),
              ('Operational', '["No-show after confirmation","Documentation issues — could not complete","Vehicle availability — customer declined alternative"]'::jsonb, 3),
              ('Other', '["Duplicate reservation","Test or training lead","Other (see notes)"]'::jsonb, 4)
            """
        )
        print("[seed] inserted cancellation_reason_categories")

    next_action_rows = query("SELECT COUNT(*)::int AS n FROM next_actions")
    if (next_action_rows[0]["n"] if next_action_rows else 0) == 0:
        query(
            """
            INSERT INTO next_actions (action, sort_order) VALUES
              ('Call again', 1),
              ('Send follow-up SMS', 2),
              ('Escalate to AM', 3),
              ('Close — no further action', 4),
              ('Verify documentation', 5),
              ('Other (see notes)', 6)
            """
        )
        print("[seed] inserted next_actions")

    for email, password_hash, role, display_name, branch in AUTH_SEED_ROWS:
        query(
            """
            INSERT INTO auth_users (email, password_hash, role, display_name, branch)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (email) DO NOTHING
            """,
            (email, password_hash, role, display_name, branch),
        )


def upsert_org_mapping(rows_to_process, cur) -> None:
    by_branch = {}
    for _, row in rows_to_process:
        branch = _val(row, "branch")
        if not branch:
            continue
        bm = _val(row, "bm_name") or ""
        am = _val(row, "area_mgr") or ""
        gm = _val(row, "general_mgr")
        zone = _val(row, "zone") or ""
        by_branch[str(branch).strip()] = (bm, am, gm, str(zone).strip())

    for branch, (bm, am, gm, zone) in by_branch.items():
        cur.execute(
            """
            INSERT INTO org_mapping (bm, branch, am, gm, zone)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (branch) DO UPDATE SET
              bm = EXCLUDED.bm,
              am = EXCLUDED.am,
              gm = EXCLUDED.gm,
              zone = EXCLUDED.zone,
              updated_at = now()
            """,
            (bm, branch, am, gm, zone),
        )


def seed_leads(file_path: Path) -> dict:
    df = pd.read_excel(file_path, engine="openpyxl")
    df_clean = clean_hles_data(df, _build_org_lookup())

    rows_to_process = []
    for _, row in df_clean.iterrows():
        confirm_num = _val(row, "confirm_num")
        if not confirm_num:
            continue
        rows_to_process.append((confirm_num, row))

    if not rows_to_process:
        return {"rowsParsed": len(df), "upserted": 0}

    upsert_sql = """
        INSERT INTO leads (
            customer, reservation_id, status, branch, bm_name, insurance_company, hles_reason,
            init_dt_final, confirm_num, knum, body_shop, cdp_name, htz_region, set_state, zone,
            area_mgr, general_mgr, rent_loc, week_of, contact_range, first_contact_by, time_to_first_contact
        )
        VALUES (
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (confirm_num) WHERE confirm_num IS NOT NULL DO UPDATE SET
            customer = EXCLUDED.customer,
            reservation_id = EXCLUDED.reservation_id,
            status = EXCLUDED.status,
            branch = EXCLUDED.branch,
            bm_name = EXCLUDED.bm_name,
            insurance_company = EXCLUDED.insurance_company,
            hles_reason = EXCLUDED.hles_reason,
            init_dt_final = EXCLUDED.init_dt_final,
            knum = EXCLUDED.knum,
            body_shop = EXCLUDED.body_shop,
            cdp_name = EXCLUDED.cdp_name,
            htz_region = EXCLUDED.htz_region,
            set_state = EXCLUDED.set_state,
            zone = EXCLUDED.zone,
            area_mgr = EXCLUDED.area_mgr,
            general_mgr = EXCLUDED.general_mgr,
            rent_loc = EXCLUDED.rent_loc,
            week_of = EXCLUDED.week_of,
            contact_range = EXCLUDED.contact_range,
            first_contact_by = EXCLUDED.first_contact_by,
            time_to_first_contact = EXCLUDED.time_to_first_contact,
            updated_at = now()
    """

    params_list = [
        (
            _val(row, "customer"),
            confirm_num,
            _val(row, "status"),
            _val(row, "branch"),
            _val(row, "bm_name"),
            _val(row, "insurance_company"),
            _val(row, "hles_reason"),
            _val(row, "init_dt_final"),
            confirm_num,
            _val(row, "knum"),
            _val(row, "body_shop"),
            _val(row, "cdp_name"),
            _val(row, "htz_region"),
            _val(row, "set_state"),
            _val(row, "zone"),
                        _val(row, "area_mgr"),
                        _val(row, "general_mgr"),
                        _val(row, "rent_loc"),
                        _val(row, "week_of"),
                        _val(row, "contact_range"),
                        _val(row, "first_contact_by"),
                        _val(row, "time_to_first_contact"),
            )
        for confirm_num, row in rows_to_process
    ]

    with with_connection() as conn:
        with conn.cursor() as cur:
            with conn.pipeline():
                for params in params_list:
                    cur.execute(upsert_sql, params)
            upsert_org_mapping(rows_to_process, cur)

    return {"rowsParsed": len(df), "upserted": len(rows_to_process)}


def verify_auth_branch_alignment(create_aligned_bm_user: bool) -> None:
    bm_rows = query("SELECT email, branch FROM auth_users WHERE role = 'bm' AND is_active = true")
    if not bm_rows:
        return

    for row in bm_rows:
        branch = row.get("branch")
        if not branch:
            continue
        count_rows = query(
            "SELECT COUNT(*)::int AS n FROM leads WHERE branch = %s AND archived = false",
            (branch,),
        )
        count = count_rows[0]["n"] if count_rows else 0
        if count > 0:
            continue
        print(
            f"[seed][warn] BM user {row['email']} has branch {branch} but seeded leads contain 0 rows."
        )
        if create_aligned_bm_user:
            candidates = query(
                """
                SELECT branch, COUNT(*)::int AS n
                FROM leads
                WHERE branch IS NOT NULL AND archived = false
                GROUP BY branch
                ORDER BY n DESC
                LIMIT 1
                """
            )
            if candidates:
                aligned_branch = candidates[0]["branch"]
                query(
                    """
                    INSERT INTO auth_users (email, password_hash, role, display_name, branch)
                    VALUES (%s, %s, 'bm', %s, %s)
                    ON CONFLICT (email) DO NOTHING
                    """,
                    (
                        "local.bm.seed@hertz.com",
                        AUTH_SEED_ROWS[2][1],
                        "Local Seed BM",
                        aligned_branch,
                    ),
                )
                print(
                    f"[seed] created local.bm.seed@hertz.com aligned to branch {aligned_branch}."
                )


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed local/staging LMS data from HLES XLSX.")
    parser.add_argument("xlsx_path", type=Path, help="Path to HLES XLSX file.")
    parser.add_argument("--target", choices=["local", "staging", "prod"], default="local")
    parser.add_argument(
        "--create-aligned-bm-user",
        action="store_true",
        help="Create a helper BM auth user when seeded data does not match existing BM branch.",
    )
    args = parser.parse_args()

    if args.target == "prod":
        print("[seed] Refusing to run against prod.")
        return 1

    if not args.xlsx_path.exists():
        print(f"[seed] File not found: {args.xlsx_path}")
        return 1

    seed_config_tables()
    stats = seed_leads(args.xlsx_path)
    verify_auth_branch_alignment(args.create_aligned_bm_user)

    refresh_days_open()
    compute_and_store_snapshot()
    compute_observatory_snapshot()

    print(
        "[seed] complete: " + json.dumps(
            {
                "target": args.target,
                "rowsParsed": stats["rowsParsed"],
                "upserted": stats["upserted"],
                "computedAt": datetime.now(timezone.utc).isoformat(),
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
