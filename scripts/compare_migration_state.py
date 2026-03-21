import os
import sys

import psycopg
from psycopg.rows import dict_row


def _read_ids(conninfo: str) -> list[str]:
    with psycopg.connect(conninfo, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id
                FROM schema_migrations
                ORDER BY applied_at ASC, id ASC
                """
            )
            return [r["id"] for r in cur.fetchall()]


def main() -> int:
    staging_url = os.getenv("STAGING_DATABASE_URL")
    prod_url = os.getenv("PROD_DATABASE_URL")
    if not staging_url or not prod_url:
        print(
            "Missing STAGING_DATABASE_URL or PROD_DATABASE_URL. "
            "Cannot compare migration state."
        )
        return 1

    staging_ids = _read_ids(staging_url)
    prod_ids = _read_ids(prod_url)

    if staging_ids != prod_ids:
        staging_set = set(staging_ids)
        prod_set = set(prod_ids)
        print("[migration-state] mismatch")
        print("- Missing in prod: " + ", ".join(sorted(staging_set - prod_set)))
        print("- Missing in staging: " + ", ".join(sorted(prod_set - staging_set)))
        return 1

    print(f"[migration-state] match ({len(staging_ids)} IDs)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
