import argparse
import csv
from pathlib import Path

from db import query


def main() -> int:
    parser = argparse.ArgumentParser(description="Export org_mapping to CSV.")
    parser.add_argument("--output", type=Path, required=True, help="Output CSV path.")
    args = parser.parse_args()

    rows = query(
        """
        SELECT branch, bm, gm, am, zone
        FROM org_mapping
        ORDER BY branch
        """
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=["branch", "bm", "gm", "am", "zone"])
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "branch": row.get("branch") or "",
                    "bm": row.get("bm") or "",
                    "gm": row.get("gm") or "",
                    "am": row.get("am") or "",
                    "zone": row.get("zone") or "",
                }
            )

    print(f"[org-mapping] exported {len(rows)} rows to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
