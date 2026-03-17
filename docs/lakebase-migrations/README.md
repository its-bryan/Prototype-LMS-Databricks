# Lakebase migrations

Run these in **Lakebase SQL Editor** (project `lms-leo`, branch `production`) or via Databricks CLI if you have `psql` installed.

## 004: Lead columns + GRANTs

**File:** `004_add_lead_columns_and_grants.sql` (migration + GRANTs in one script)

### Option A — Lakebase SQL Editor (no local dependencies)

1. Open [Databricks Lakebase](https://databricks.com/product/lakebase) → project **lms-leo**, branch **production**.
2. Open the SQL Editor, select database `databricks_postgres`.
3. Paste and run the full contents of `004_add_lead_columns_and_grants.sql`.

### Option B — CLI (requires `psql` on PATH)

Install PostgreSQL so `psql` is available (e.g. [PostgreSQL downloads](https://www.postgresql.org/download/windows/) or `winget install PostgreSQL.PostgreSQL.17`). Then from the repo root:

```bash
databricks psql --project lms-leo --branch production -p DanSiaoAuth -- -f docs/lakebase-migrations/004_add_lead_columns_and_grants.sql
```

On Windows PowerShell you can use the helper script (finds common psql install paths):

```powershell
.\scripts\run-lakebase-migration.ps1
```

(Note: `scripts/` is gitignored; the script is for local use only.)
