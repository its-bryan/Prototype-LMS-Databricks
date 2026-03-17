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

The React app currently runs on mock data (`src/data/mockData.js`). To connect it to the live Lakebase Postgres via the FastAPI backend:

1. Rebuild the React app with the Databricks flag:
   ```bash
   cd prototype-lms
   VITE_USE_DATABRICKS=true npm run build
   ```
2. This makes `DataContext` import from `databricksData.js` (which calls `/api/*`) instead of using mock data
3. Redeploy the app so the new `dist/` is served by FastAPI

### Additional frontend tasks

- [ ] Build React app with `VITE_USE_DATABRICKS=true`
- [ ] Verify all API endpoints work against production database
- [ ] Remove or disable demo role picker (replace with real auth)

---

## Data Pipeline

- [ ] Test HLES file upload with real data format
- [ ] Test TRANSLOG file upload with real data format
- [ ] Confirm column mappings in `etl/clean.py` match actual file headers (see `HANDOFF-ETL-PHASE2.md`)

---

## Known Bugs

- [ ] **Compliance task creation fails** — "Create tasks" button in GM Meeting Prep branch compliance returns an error. The backend `POST /api/tasks/compliance` endpoint was fixed to extract lead IDs from full lead objects, but task creation still fails. Needs debugging — check the Databricks App logs for the actual error. Likely a schema mismatch (missing column) or constraint violation in the `tasks` table INSERT.
- [ ] **`PUT /leads/{id}/directive` returns `{"ok": true}` instead of the full lead row** — after saving a GM directive, the lead object in React state gets replaced with a broken object from `leadFromRow({"ok": true})`. Fix: return `SELECT * FROM leads WHERE id = %s` after the UPDATE.
- [ ] **`week_of` column missing from leads table** — `setNowFromLeads()` looks for `weekOf`/`week_of` to set the app's demo date. Column doesn't exist yet — part of the ETL migration (`HANDOFF-ETL-PHASE2.md`). Until added, the app defaults to Feb 22, 2026 as "now".

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-16 | Created checklist |
| 2026-03-17 | Added known bugs: compliance task creation, directive response, missing week_of column |
