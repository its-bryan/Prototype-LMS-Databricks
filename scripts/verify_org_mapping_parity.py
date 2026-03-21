import argparse
import csv
from pathlib import Path

from db import query


def _normalize(value):
    return (value or "").strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify org_mapping parity vs source CSV.")
    parser.add_argument("--source", type=Path, required=True, help="CSV source path.")
    args = parser.parse_args()

    if not args.source.exists():
        print(f"[org-mapping] source file not found: {args.source}")
        return 1

    source = {}
    with args.source.open("r", newline="", encoding="utf-8") as fp:
        reader = csv.DictReader(fp)
        for row in reader:
            branch = _normalize(row.get("branch"))
            if not branch:
                continue
            source[branch] = (
                _normalize(row.get("bm")),
                _normalize(row.get("gm")),
                _normalize(row.get("am")),
                _normalize(row.get("zone")),
            )

    db_rows = query("SELECT branch, bm, gm, am, zone FROM org_mapping")
    current = {
        _normalize(row.get("branch")): (
            _normalize(row.get("bm")),
            _normalize(row.get("gm")),
            _normalize(row.get("am")),
            _normalize(row.get("zone")),
        )
        for row in db_rows
        if _normalize(row.get("branch"))
    }

    missing = sorted(set(source.keys()) - set(current.keys()))
    extra = sorted(set(current.keys()) - set(source.keys()))
    mismatches = []
    for branch in sorted(set(source.keys()) & set(current.keys())):
        if source[branch] != current[branch]:
            mismatches.append((branch, source[branch], current[branch]))

    if missing or extra or mismatches:
        print("[org-mapping] parity check FAILED")
        if missing:
            print(f"- Missing branches in DB: {', '.join(missing)}")
        if extra:
            print(f"- Extra branches in DB: {', '.join(extra)}")
        if mismatches:
            print(f"- Field mismatches: {len(mismatches)}")
            for branch, expected, actual in mismatches[:25]:
                print(
                    f"  {branch}: expected bm/gm/am/zone={expected}, actual={actual}"
                )
        return 1

    print(f"[org-mapping] parity check passed ({len(source)} branches)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
