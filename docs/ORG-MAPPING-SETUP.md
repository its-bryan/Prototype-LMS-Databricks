# Org Mapping Setup

How to build and restore the `org_mapping` table, which drives the full
**BM → Branch → AM → GM → Zone** hierarchy used throughout the dashboard.

---

## Source files

| File | Location | Purpose |
|------|----------|---------|
| `All IR Detail 2026.03.16 (1).xlsx` | `prodfiles/` | Authoritative source for branch codes, AM, GM, Zone |
| `March 2026 employee listing.xlsx` | `prodfiles/` | BM names (Mgr Branch I/II rows) |

### Join logic

The employee listing does not share a direct key with the HLES branch codes.
They are linked via the **`Area`** column in the employee listing:

- HLES branch code format: `5567-03    - HIALEAH HLE`
- Employee listing `Area` for that BM: `5567`
- The `Area` number is the **numeric prefix** of the HLES branch code (everything before the first `-`)

This gives us BM → specific branch assignments without ambiguity.

---

## Coverage (March 2026)

- **1,104** total branches from HLES
- **697** branches with a BM assigned from the employee listing
- Branches without a BM (empty string): Canadian zones, LICENSEE, HI, and any US
  branches not listed in the March 2026 employee file

---

## Option 1 — Re-seed from prodfiles (preferred)

Run this whenever the prodfiles are updated with a new month's data:

```bash
cd /path/to/Prototype-LMS-Databricks
source .venv/bin/activate
env $(cat .env.local | grep -v '^#' | xargs) python scripts/seed_org_mapping_from_prodfiles.py --dry-run
env $(cat .env.local | grep -v '^#' | xargs) python scripts/seed_org_mapping_from_prodfiles.py
```

The script:
1. Reads HLES for all `branch → AM → GM → Zone` rows
2. Reads the employee listing for `BM → Area` (branch prefix) rows
3. Joins on the numeric branch prefix
4. Upserts into `org_mapping` — preserving any existing manual BM edits for branches
   not found in the employee file

To point at different source files:

```bash
env $(cat .env.local | grep -v '^#' | xargs) python scripts/seed_org_mapping_from_prodfiles.py \
  --hles "prodfiles/All IR Detail 2026.04.xx.xlsx" \
  --employees "prodfiles/April 2026 employee listing.xlsx"
```

---

## Option 2 — Restore from SQL snapshot (after a wipe)

A point-in-time SQL snapshot from March 2026 is saved at:

```
docs/lakebase-migrations/018_restore_org_mapping_march2026.sql
```

Run it in Lakebase or psql:

```sql
-- In Lakebase SQL editor or psql:
\i docs/lakebase-migrations/018_restore_org_mapping_march2026.sql
```

This will `TRUNCATE` the table and re-insert all 1,104 rows.

> **Note:** This snapshot is frozen in time. Prefer Option 1 with current prodfiles
> if you have them available.

---

## Option 3 — Refresh from the UI

In the dashboard, navigate to **Settings → Organisation Mapping** and click
**Refresh from Source Files**. This calls `POST /api/config/org-mapping/seed-from-prodfiles`
which runs the same logic as Option 1 using whichever prodfiles are on disk.

---

## Manual BM edits

Any BM can be manually overridden in the UI by clicking their name in the org
mapping table. Manual edits are persisted to the DB via
`PATCH /api/config/org-mapping/{branch}/bm`.

When re-seeding (Option 1 or 3), the upsert logic **preserves existing non-empty BMs**
for branches that have no match in the employee listing. However, branches that do
match the employee listing will have their BM **overwritten** with the file value —
so re-seed with care if you have made manual corrections to branches that also appear
in the employee file.

---

## Verify after seeding

```sql
SELECT COUNT(*) FROM org_mapping;
-- expect 1104

SELECT COUNT(*) FROM org_mapping WHERE bm IS NOT NULL AND bm != '';
-- expect 697 (March 2026 baseline)

SELECT zone,
       COUNT(*) AS branches,
       COUNT(CASE WHEN bm != '' THEN 1 END) AS bm_assigned
FROM org_mapping
GROUP BY zone
ORDER BY zone;
```
