# Known Issues & Technical Debt

## 1. Executive Summary

LEO is a **production-ready prototype** — functional and deployed on Databricks Apps with real data, but built with MVP trade-offs that would need to be addressed before scaling to a full production system. The core data pipeline and dashboard rendering are solid. The main risk areas are: (1) MVP authentication that needs to be replaced with SSO, (2) some metrics stored as text rather than typed columns, and (3) limited API-level authorization enforcement.

---

## 2. Known Bugs

| Bug | Location | Impact | Workaround |
|-----|----------|--------|------------|
| `time_to_first_contact` stored as text | `leads` table | MIN_DIF from HLES is stored as raw text, not numeric. Parsing happens in JavaScript (`parseTimeToMinutes`). No validated numeric column exists. | Frontend handles parsing; works but fragile |
| Login activity in activity-report is simulated | `routers/leads.py` lines ~656-665 | Activity report shows "last login" data that is fabricated from hardcoded time offsets against org_mapping data, not real login tracking. | No real login tracking exists — activity report login data should not be relied upon |
| `branch_managers.quartile` may be stale | `branch_managers` table | Cached quartile may not match live calculation from leads data. | Use live computation from snapshot instead |

### Previously Fixed Bugs (for reference)

- **Compliance task creation** — was sending invalid UUID (`demo-gm`) as `created_by`. Fixed: coerce invalid IDs to NULL.
- **PUT /leads/{id}/directive returned `{"ok": true}`** — caused broken lead objects in React state. Fixed: now returns full lead row.
- **`week_of` column missing** — Fixed in migration 004.

---

## 3. Security Concerns

| Concern | Severity | Location | Detail |
|---------|----------|----------|--------|
| Hardcoded JWT default secret | **HIGH** | `routers/auth.py` line 18 | `LEO_JWT_SECRET` defaults to `leo-mvp-secret-change-in-prod` if env var is not set. Must be rotated in all environments. |
| MVP authentication | **MEDIUM** | `routers/auth.py` line 1 | Auth is marked "MVP — Replace with Hertz SSO when ready". bcrypt passwords in `auth_users` table. |
| No rate limiting | **MEDIUM** | `routers/auth.py` | Login endpoint has no rate limiter — vulnerable to brute force |
| Inconsistent RBAC at API level | **MEDIUM** | All routers | JWT is decoded but role is not consistently checked on endpoints. Data scoping (BM sees own branch) is implemented in `leads.py` but not enforced as middleware. |
| No PII encryption at rest | **LOW** | `leads` table | Customer names, emails, phones stored in plaintext |
| GRANT client IDs in migration files | **LOW** | `008_dashboard_snapshots.sql`, `016_feedback_feature_requests.sql` | Service principal client IDs visible in committed SQL files |

> See [09-security-access-control.md](09-security-access-control.md) for full security architecture details.

---

## 4. Technical Debt

### Code Quality

| Issue | Location | Effort | Detail |
|-------|----------|--------|--------|
| No Pydantic models for API input | All routers | Medium | Endpoints accept raw `dict` bodies via `await request.json()`. No structured validation, no auto-generated API docs for request bodies. |
| Raw SQL throughout | `db.py`, all routers | Low (intentional) | No ORM — intentional for Lakebase compatibility, but increases maintenance burden. All queries are hand-written SQL strings. |
| No API versioning | `main.py` | Low | All routes are `/api/...` with no version prefix. Breaking changes require coordination. |
| Duplicated denormalised names | `tasks`, `lead_activities`, `gm_directives` | Low | `created_by_name`, `assigned_to_name`, `performed_by_name` are stored alongside UUIDs. Can go stale if display_name changes. |

### Unused / Legacy Tables

| Table | Status | Notes |
|-------|--------|-------|
| `user_profiles` | Likely unused | Predates `auth_users`. May still be read by config router but functionally replaced. |
| `branch_managers` | Possibly stale | Cached BM metrics — may not be populated from current snapshot pipeline. |
| `weekly_trends` | Possibly stale | BM/GM weekly metrics — may not be populated from current pipeline. |
| `leaderboard_data` | Possibly stale | Cached leaderboard — snapshot may compute this live instead. |

### Upload Pipeline

| Issue | Location | Detail |
|-------|----------|--------|
| 50MB upload in memory | `routers/upload.py` | Entire Excel file is read into memory via `await file.read()`. No streaming. |
| No upload scheduling | Manual process | Uploads are manual (admin clicks upload). No scheduled/automated ingestion. |
| No upload rollback | `routers/upload.py` | If an upload partially fails, some rows may be inserted while others fail. No transaction-level rollback across the batch. |

---

## 5. Missing Features / Gaps

| Feature | Impact | Notes |
|---------|--------|-------|
| No comprehensive audit logging | High | No API-level audit trail. `enrichment_log` and `notes_log` track lead/task changes, but there's no log of who viewed what or made API calls. |
| No automated uploads | Medium | HLES/TRANSLOG uploads require manual admin action. No scheduled pipeline from Unity Catalog Volumes. |
| No backup/restore procedures | Medium | No documented backup strategy for Lakebase Postgres. Forward-fix only for data corruption. |
| No health monitoring beyond `/api/health/runtime` | Medium | No external monitoring, alerting, or uptime tracking. |
| No API versioning | Low | Breaking API changes require frontend/backend coordination. |
| No pagination on some endpoints | Low | Endpoints like `GET /api/wins-learnings` (fetches last 200) and `GET /api/feedback` may need pagination at scale. |
| No E2E test CI pipeline | Low | Playwright tests exist but are run manually. No GitHub Actions or CI integration. |

---

## 6. Performance Considerations

| Area | Current State | Notes |
|------|--------------|-------|
| Lead volume | 800K+ rows | Addressed with partial indexes in migration 017 |
| Snapshot pre-computation | Effective | Avoids real-time aggregation. Dashboard loads fast. |
| Connection pool | min=2, max=12 | May need tuning under concurrent load |
| `org_mapping` queries | Full table scan per call | `_branches_for_gm()` does `SELECT branch FROM org_mapping WHERE gm = %s` — fine at ~50 rows, but not indexed on `gm` |
| JSONB column size | Unbounded | `enrichment_log` and `translog` arrays grow without limit per lead |
| Frontend bundle | Lazy-loaded | Code splitting via `lazyWithRetry` reduces initial load |

---

## 7. Priority Matrix

| Issue | Severity | Effort | Recommendation |
|-------|----------|--------|----------------|
| Rotate JWT default secret | **Critical** | Low | Set `LEO_JWT_SECRET` env var in all environments immediately |
| Add rate limiting to login | **High** | Low | Add FastAPI rate limiter middleware (e.g., `slowapi`) |
| Replace MVP auth with SSO | **High** | High | Plan Hertz SSO integration — `auth_users` table designed to be dropped |
| Add consistent RBAC middleware | **High** | Medium | Create role-checking dependency that wraps all protected routes |
| Add Pydantic request models | **Medium** | Medium | Improves validation, error messages, and auto-generated API docs |
| Fix `time_to_first_contact` type | **Medium** | Medium | Add numeric column, backfill from text, update ETL |
| Remove fake login activity data | **Medium** | Low | Remove hardcoded offsets in `routers/leads.py`, show real data or "not tracked" |
| Add API audit logging | **Medium** | Medium | Log all write operations with user, timestamp, and payload |
| Clean up unused tables | **Low** | Low | Verify `user_profiles`, `branch_managers`, `weekly_trends`, `leaderboard_data` usage and drop if unused |
| Add upload streaming | **Low** | Medium | Stream Excel parsing instead of reading entire file into memory |
| Automate HLES uploads | **Low** | Medium | Scheduled job reading from Unity Catalog Volumes |
| Add CI for E2E tests | **Low** | Low | GitHub Actions workflow running Playwright on PR |

---

## 8. Production Readiness Checklist

Carried forward from `docs/PROD-READY.md`:

- [ ] Rotate JWT secret in all environments
- [ ] Remove demo seed data from `user_profiles` and `org_mapping`
- [ ] Load real org mapping from client
- [ ] Create real user accounts in `auth_users`
- [ ] Restrict database GRANTs to minimum required permissions
- [ ] Verify all API endpoints work against production database
- [ ] Test HLES and TRANSLOG uploads with real data formats
- [ ] Remove or disable demo role picker (if still present in frontend)
- [ ] Set up monitoring/alerting for service health
- [ ] Document backup/restore procedures for Lakebase Postgres
