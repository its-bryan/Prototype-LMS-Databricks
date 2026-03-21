import argparse
import os
import sys

import psycopg
from psycopg.rows import dict_row


EXPECTED_MIGRATION_IDS = [
    "001_full_schema",
    "002_seed_config",
    "003_phase2_tables",
    # 004 handled via dual-name compatibility check below.
    "005_confirm_num_unique_reservation_id_nullable",
    "006_delete_demo_data",
    "007_bm_from_employee_listing_frankel",
    "007a_export_branches_for_bm_mapping",
    "008_auth_users",
    "008_dashboard_snapshots",
    "009_grant_auth_users",
    "014_auth_users_onboarding",
    "015_observatory_snapshots",
    "016_feedback_feature_requests",
    "017_performance_indexes",
]

REQUIRED_TABLES = {
    "auth_users",
    "branch_managers",
    "cancellation_reason_categories",
    "dashboard_snapshots",
    "feature_request_upvotes",
    "feature_requests",
    "feedback",
    "gm_directives",
    "lead_activities",
    "leaderboard_data",
    "leads",
    "next_actions",
    "observatory_snapshots",
    "org_mapping",
    "schema_migrations",
    "tasks",
    "upload_summary",
    "user_profiles",
    "weekly_trends",
    "wins_learnings",
}

REQUIRED_INDEXES = {
    "idx_leads_branch_status_date",
    "idx_leads_bm_name_status_date",
    "idx_leads_status_date",
    "idx_leads_contact_range",
    "idx_leads_first_contact_by",
    "idx_tasks_lead_id_created_status",
    "idx_tasks_status_created",
    "idx_org_mapping_branch",
    "idx_org_mapping_gm",
    "idx_dashboard_snapshots_created_at",
    "idx_observatory_snapshots_created_at",
}


def _build_conninfo() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url
    host = os.getenv("PGHOST")
    db = os.getenv("PGDATABASE")
    user = os.getenv("PGUSER")
    password = os.getenv("PGPASSWORD")
    port = os.getenv("PGPORT", "5432")
    if not (host and db and user):
        raise RuntimeError(
            "Missing connection settings. Provide DATABASE_URL or PGHOST/PGDATABASE/PGUSER."
        )
    parts = [f"host={host}", f"dbname={db}", f"user={user}", f"port={port}"]
    if password:
        parts.append(f"password={password}")
    if ".databricks.com" in host and "sslmode=" not in (database_url or ""):
        parts.append("sslmode=require")
    return " ".join(parts)


def _fetch_set(cur, sql: str) -> set[str]:
    cur.execute(sql)
    return {row["name"] for row in cur.fetchall()}


def main() -> int:
    parser = argparse.ArgumentParser(description="Check LMS schema/index drift.")
    parser.add_argument("--target", choices=["local", "staging", "prod"], default="local")
    args = parser.parse_args()

    conninfo = _build_conninfo()
    failures: list[str] = []

    with psycopg.connect(conninfo, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            tables = _fetch_set(
                cur,
                """
                SELECT tablename AS name
                FROM pg_tables
                WHERE schemaname = 'public'
                """,
            )
            missing_tables = sorted(REQUIRED_TABLES - tables)
            if missing_tables:
                failures.append(f"Missing tables: {', '.join(missing_tables)}")

            indexes = _fetch_set(
                cur,
                """
                SELECT indexname AS name
                FROM pg_indexes
                WHERE schemaname = 'public'
                """,
            )
            missing_indexes = sorted(REQUIRED_INDEXES - indexes)
            if missing_indexes:
                failures.append(f"Missing indexes: {', '.join(missing_indexes)}")

            if "schema_migrations" not in tables:
                failures.append("Missing schema_migrations ledger table.")
            else:
                cur.execute("SELECT id FROM schema_migrations ORDER BY applied_at ASC, id ASC")
                applied = [row["id"] for row in cur.fetchall()]
                has_004 = (
                    "004_add_lead_columns" in applied
                    or "004_add_lead_columns_and_grants" in applied
                )
                if not has_004:
                    failures.append(
                        "Missing migration ID: one of "
                        "004_add_lead_columns or 004_add_lead_columns_and_grants"
                    )
                missing_ids = [mid for mid in EXPECTED_MIGRATION_IDS if mid not in applied]
                if missing_ids:
                    failures.append(
                        "Missing migration IDs: " + ", ".join(missing_ids)
                    )
                order_map = {mid: i for i, mid in enumerate(applied)}
                out_of_order = []
                for i in range(len(EXPECTED_MIGRATION_IDS) - 1):
                    left = EXPECTED_MIGRATION_IDS[i]
                    right = EXPECTED_MIGRATION_IDS[i + 1]
                    if left in order_map and right in order_map and order_map[left] > order_map[right]:
                        out_of_order.append(f"{left} appears after {right}")
                if out_of_order:
                    failures.append("Out-of-order migrations: " + "; ".join(out_of_order))

    if failures:
        print(f"[schema-drift] target={args.target} status=DRIFT")
        for msg in failures:
            print(f"- {msg}")
        return 1

    print(f"[schema-drift] target={args.target} status=CLEAN")
    return 0


if __name__ == "__main__":
    sys.exit(main())
