"""Seed org_mapping from prodfiles: March 2026 employee listing + All IR Detail (HLES).

Join logic:
  - HLES (All IR Detail) is the authoritative source for branch → AM → GM → Zone.
  - Employee listing provides BM names: each BM row has an 'Area' number that is
    the numeric prefix of HLES branch codes (e.g. Area=5567 matches '5567-03 - HIALEAH HLE').
  - When multiple branches share the same Area prefix, the same BM is assigned to all.
  - HLES branches with no matching BM in the employee listing get an empty BM.

Usage:
    python scripts/seed_org_mapping_from_prodfiles.py
    python scripts/seed_org_mapping_from_prodfiles.py --dry-run
    python scripts/seed_org_mapping_from_prodfiles.py \\
        --hles "prodfiles/All IR Detail 2026.03.16 (1).xlsx" \\
        --employees "prodfiles/March 2026 employee listing.xlsx"
"""

import argparse
import re
import sys
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _norm_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise DataFrame column names: strip whitespace/newlines, lowercase, spaces→underscores."""
    df.columns = [re.sub(r"\s+", "_", col.strip().lower()) for col in df.columns]
    return df


def _branch_prefix(rent_loc: str) -> str | None:
    """Extract numeric prefix from HLES rent_loc, e.g. '5567-03    - HIALEAH HLE' → '5567'."""
    m = re.match(r"^(\d+)-", str(rent_loc).strip())
    return m.group(1) if m else None


def _norm_display_name(name: str) -> str:
    """Normalise employee display name for GM matching.

    'Last, First Middle (Nickname)' → 'FIRST LAST'  (uppercase, no nickname)
    Already-upper names like 'ADAM FRANKEL' are returned as-is.
    """
    name = re.sub(r"\([^)]+\)", "", str(name)).strip()
    parts = name.split(",", 1)
    if len(parts) == 2:
        last = parts[0].strip()
        first_parts = parts[1].strip().split()
        first = first_parts[0] if first_parts else ""
        return f"{first} {last}".upper().strip()
    return name.upper().strip()


# ---------------------------------------------------------------------------
# Build org mapping
# ---------------------------------------------------------------------------

def build_org_mapping(hles_path: Path, emp_path: Path) -> list[dict]:
    """Return list of dicts with keys: branch, bm, am, gm, zone."""

    # --- Load HLES ---
    hles_raw = pd.read_excel(hles_path)
    hles = _norm_cols(hles_raw)

    required_hles = {"rent_loc", "area_mgr", "general_mgr", "zone"}
    missing = required_hles - set(hles.columns)
    if missing:
        raise ValueError(f"HLES file missing columns: {missing}")

    # Distinct branches with AM/GM/Zone from HLES
    hles_org = (
        hles[["rent_loc", "area_mgr", "general_mgr", "zone"]]
        .drop_duplicates(subset="rent_loc")
        .dropna(subset=["rent_loc"])
        .copy()
    )
    hles_org["prefix"] = hles_org["rent_loc"].apply(_branch_prefix)

    print(f"[seed] HLES: {len(hles_org)} distinct branches loaded")

    # --- Load employee listing ---
    emp = pd.read_excel(emp_path)

    required_emp = {"area", "display_name", "job_description", "supervisor_name", "zone"}
    emp_norm = _norm_cols(emp.copy())
    missing_emp = required_emp - set(emp_norm.columns)
    if missing_emp:
        raise ValueError(f"Employee listing missing columns: {missing_emp}")

    # BM rows: Mgr Branch I / II
    bm_rows = emp_norm[emp_norm["job_description"].str.startswith("Mgr Branch", na=False)].copy()
    bm_rows["area_str"] = bm_rows["area"].astype(str).str.strip()
    print(f"[seed] Employee listing: {len(bm_rows)} BM rows")

    # --- Join BMs to HLES branches via Area prefix ---
    # One BM → one Area prefix → potentially multiple sub-branches (e.g. 5567-01, 5567-03)
    merged = bm_rows.merge(hles_org, left_on="area_str", right_on="prefix", how="inner")
    print(f"[seed] Matched {len(merged)} BM→branch pairs")

    # Build branch → bm mapping (last BM wins if multiple match same branch, unlikely)
    branch_to_bm: dict[str, str] = {}
    for _, row in merged.iterrows():
        branch = str(row["rent_loc"]).strip()
        bm = str(row["display_name"]).strip()
        branch_to_bm[branch] = bm

    # --- Assemble final rows ---
    result = []
    for _, row in hles_org.iterrows():
        branch = str(row["rent_loc"]).strip()
        am = str(row["area_mgr"]).strip() if row["area_mgr"] and pd.notna(row["area_mgr"]) else ""
        gm = str(row["general_mgr"]).strip() if row["general_mgr"] and pd.notna(row["general_mgr"]) else None
        zone = str(row["zone"]).strip() if row["zone"] and pd.notna(row["zone"]) else ""
        bm = branch_to_bm.get(branch, "")
        result.append({"branch": branch, "bm": bm, "am": am, "gm": gm, "zone": zone})

    assigned = sum(1 for r in result if r["bm"])
    print(f"[seed] {assigned}/{len(result)} branches have a BM assigned")

    return result


# ---------------------------------------------------------------------------
# Upsert into database
# ---------------------------------------------------------------------------

def upsert_org_mapping(rows: list[dict]) -> int:
    """Upsert rows into org_mapping. Returns number of rows upserted."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from db import with_connection  # local import so script can be imported without db

    sql = """
        INSERT INTO org_mapping (bm, branch, am, gm, zone)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (branch) DO UPDATE SET
            am   = EXCLUDED.am,
            gm   = EXCLUDED.gm,
            zone = EXCLUDED.zone,
            bm   = CASE
                     WHEN EXCLUDED.bm IS NOT NULL AND EXCLUDED.bm != ''
                     THEN EXCLUDED.bm
                     ELSE org_mapping.bm
                   END,
            updated_at = now()
    """
    with with_connection() as conn:
        with conn.cursor() as cur:
            for r in rows:
                cur.execute(sql, (r["bm"], r["branch"], r["am"], r["gm"], r["zone"]))
    return len(rows)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

PRODFILES = Path(__file__).parent.parent / "prodfiles"

DEFAULT_HLES = PRODFILES / "All IR Detail 2026.03.16 (1).xlsx"
DEFAULT_EMP = PRODFILES / "March 2026 employee listing.xlsx"


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed org_mapping from prodfiles.")
    parser.add_argument("--hles", type=Path, default=DEFAULT_HLES, help="Path to All IR Detail xlsx")
    parser.add_argument("--employees", type=Path, default=DEFAULT_EMP, help="Path to employee listing xlsx")
    parser.add_argument("--dry-run", action="store_true", help="Build mapping but do not write to DB")
    args = parser.parse_args()

    if not args.hles.exists():
        print(f"[seed] ERROR: HLES file not found: {args.hles}")
        return 1
    if not args.employees.exists():
        print(f"[seed] ERROR: Employee listing not found: {args.employees}")
        return 1

    rows = build_org_mapping(args.hles, args.employees)

    if args.dry_run:
        print("[seed] --dry-run: skipping DB write")
        print("[seed] Sample output (first 10 rows):")
        for r in rows[:10]:
            print(" ", r)
        return 0

    n = upsert_org_mapping(rows)
    print(f"[seed] Upserted {n} rows into org_mapping")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
