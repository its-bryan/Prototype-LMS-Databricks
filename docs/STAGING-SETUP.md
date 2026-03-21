# Staging Setup (Databricks App + `lms_staging`)

This is a one-time admin runbook.

## Current confirmed state

- Lakebase host is shared with prod.
- Prod DB: `databricks_postgres`
- Staging DB: `lms_staging` (already created)
- Endpoint name: `projects/lms-leo/branches/production/endpoints/primary`

## 1) Apply schema and seed on `lms_staging`

Because this laptop has no `psql`, run SQL in Lakebase SQL Editor against `lms_staging`.

Apply migration set in order:

1. `001_full_schema.sql`
2. `002_seed_config.sql`
3. `003_phase2_tables.sql`
4. `004_add_lead_columns.sql`
5. `005_confirm_num_unique_reservation_id_nullable.sql`
6. `006_delete_demo_data.sql`
7. `007_bm_from_employee_listing_frankel.sql`
8. `007a_export_branches_for_bm_mapping.sql` (reference query)
9. `008_auth_users.sql`
10. `008_dashboard_snapshots.sql`
11. `014_auth_users_onboarding.sql`
12. `015_observatory_snapshots.sql`
13. `016_feedback_feature_requests.sql`
14. `017_performance_indexes.sql`

Then create and populate `schema_migrations`:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz DEFAULT now()
);
```

Insert all migration IDs in order.

## 2) Create staging app

Create Databricks app: `hertz-leo-lms-staging`.

`app.yaml` runtime branching is the source of truth for tier/database selection.
It uses `DATABRICKS_APP_NAME` to set:

- `hertz-leo-lms-staging` -> `APP_ENV=databricks`, `APP_TIER=staging`, `PGDATABASE=lms_staging`
- `hertz-leo-leadsmgmtsystem` -> `APP_ENV=databricks`, `APP_TIER=prod`, `PGDATABASE=databricks_postgres`

In Databricks Apps UI, only keep values that are common/optional for both apps:

- `ENDPOINT_NAME=projects/lms-leo/branches/production/endpoints/primary` (if not already present)
- `HLES_LANDING_VOLUME_PATH=/Volumes/datalabs/lab_lms_staging/hles_landing_staging` (optional)
- `TRANSLOG_LANDING_VOLUME_PATH=/Volumes/datalabs/lab_lms_staging/translog_landing_staging` (optional)

## 3) Service principal and grants

Get staging SPN:

```powershell
databricks apps get hertz-leo-lms-staging -p DanSiaoAuth
```

Run GRANT SQL in `lms_staging` for that SPN on all required tables.

## 4) Deploy and verify

Deploy:

```powershell
./scripts/deploy_staging.ps1 -BaseUrl https://<staging-app-url>
```

Validate:

- `/api/health/runtime` returns `tier=staging`, `db=lms_staging`
- Staging banner visible in UI
- Smoke test passes

## Staging data policy

- Use curated/sanitized datasets only.
- Log source/provenance for each seed run.
- Refresh cadence is manual/as-needed.
- Never copy raw PII unless explicitly approved and masked.
