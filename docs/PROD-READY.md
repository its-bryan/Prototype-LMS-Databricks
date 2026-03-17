# Production Readiness Checklist — LMS Prototype

> **Purpose**: Steps to complete before the LMS goes live in production on Databricks.

---

## Database Cleanup

### Clear demo seed data

The `002_seed_config.sql` script inserts dummy data for testing. Before production, remove:

```sql
-- Remove demo user profiles (replace with real users)
DELETE FROM user_profiles;

-- Remove sample org mapping (replace with real BM/Branch/GM hierarchy)
DELETE FROM org_mapping;
```

### Keep these (real app config)

- `cancellation_reason_categories` — dropdown options (review with stakeholders, adjust if needed)
- `next_actions` — BM follow-up options (review with stakeholders, adjust if needed)

### Load production data

- Import real org mapping (BM → Branch → AM → GM → Zone) from client
- Create real user profiles linked to Databricks/SSO user IDs

---

## Environment

- [ ] Set `DATABASE_URL` in Databricks App config using a secret scope (not plaintext)
- [ ] Confirm OAuth token refresh strategy (tokens expire — app needs a valid token at runtime)
- [ ] Set `search_path` to `lab_lms_prod` schema if using separate dev/prod schemas

---

## Security

- [ ] Restrict database grants to only SELECT, INSERT, UPDATE, DELETE (no DROP/CREATE in prod)
- [ ] Review which users/service principals have access to the Lakebase endpoint
- [ ] Remove any hardcoded tokens or credentials from code before deploying

---

## Frontend — Switch from Mock Data to Live Database

The deployed app uses the Databricks backend: `DataContext` imports `databricksData.js` (calls `/api/*`). No build flag — it's the default in this repo. After frontend changes: `npm run build`, then redeploy via `databricks apps deploy` (see `DatabricksLearnings.md`).

### Additional frontend tasks

- [x] Use live API (databricksData.js) — done
- [ ] Verify all API endpoints work against production database
- [ ] Remove or disable demo role picker (replace with real auth)

---

## Data Pipeline

- [ ] Test HLES file upload with real data format
- [ ] Test TRANSLOG file upload with real data format
- [ ] Confirm column mappings in `etl/clean.py` match actual file headers (see `HANDOFF-ETL-PHASE2.md`)

---

## Known Bugs

- [x] **Compliance task creation fails** — Fixed. Backend was sending `created_by` from demo role (`demo-gm`), which is not a valid UUID. Now we coerce invalid IDs to NULL and normalize `due_date` to YYYY-MM-DD.
- [x] **`PUT /leads/{id}/directive` returns `{"ok": true}`** — Fixed. Endpoint now returns full lead row after UPDATE.
- [x] **`week_of` column missing from leads table** — Fixed. Migration 004 added `week_of` and other HLES columns to `leads`.

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-16 | Created checklist |
| 2026-03-17 | Added known bugs: compliance task creation, directive response, missing week_of column |
