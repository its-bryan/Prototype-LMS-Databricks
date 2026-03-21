import argparse
import csv
from pathlib import Path

from db import with_connection


def main() -> int:
    parser = argparse.ArgumentParser(description="Import org mapping CSV into database.")
    parser.add_argument("--source", type=Path, required=True, help="CSV source path.")
    args = parser.parse_args()

    if not args.source.exists():
        print(f"[org-mapping] source file not found: {args.source}")
        return 1

    rows = []
    with args.source.open("r", newline="", encoding="utf-8") as fp:
        reader = csv.DictReader(fp)
        for row in reader:
            rows.append(
                (
                    (row.get("bm") or "").strip(),
                    (row.get("branch") or "").strip(),
                    (row.get("am") or "").strip(),
                    (row.get("gm") or "").strip() or None,
                    (row.get("zone") or "").strip(),
                )
            )

    if not rows:
        print("[org-mapping] no rows to import")
        return 0

    with with_connection() as conn:
        with conn.cursor() as cur:
            for bm, branch, am, gm, zone in rows:
                if not branch:
                    continue
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

    print(f"[org-mapping] imported {len(rows)} rows from {args.source}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
