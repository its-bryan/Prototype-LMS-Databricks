# Metrics Audit

> Generated: 2026-03-23
> Covers all metrics displayed across the BM dashboard, GM dashboard, leaderboard, observatory, and feedback pages.

---

## 1. Lead Volume Metrics

| Metric Name | Definition | How It's Calculated | Data Fields | Schema Status |
|---|---|---|---|---|
| **Total Leads** | All non-reviewed leads in scope | `COUNT(*) WHERE status != 'Reviewed'` | `leads.status` | ✅ |
| **Rented** | Leads that converted to a rental | `COUNT(*) WHERE status = 'Rented'` | `leads.status` | ✅ |
| **Cancelled** | Leads cancelled by insurer/customer | `COUNT(*) WHERE status = 'Cancelled'` | `leads.status` | ✅ |
| **Unused** | Leads that expired without resolution | `COUNT(*) WHERE status = 'Unused'` | `leads.status` | ✅ |

---

## 2. Conversion Metrics

| Metric Name | Definition | How It's Calculated | Data Fields | Schema Status |
|---|---|---|---|---|
| **Conversion Rate** | % of leads that became rentals | `ROUND((rented / total) * 100)` | `leads.status` | ✅ |
| **Δ Conversion (improvement_delta)** | Week-over-week conversion rate change | `current_conv_rate − prev_conv_rate` across two 7-day windows derived from snapshot service | `leads.status`, `leads.init_dt_final` | ✅ (computed, no dedicated column) |
| **Conversion Rate by Insurer** | Conversion rate segmented per insurance company | `ROUND((rented_for_insurer / total_for_insurer) * 100)` | `leads.insurance_company`, `leads.status` | ✅ |
| **Δ Conv Rate by Insurer** | Period-over-period change per insurer | Same delta logic as above, scoped to insurer | `leads.insurance_company`, `leads.status`, `leads.init_dt_final` | ✅ (computed) |

---

## 3. Contact Quality Metrics

| Metric Name | Definition | How It's Calculated | Data Fields | Schema Status |
|---|---|---|---|---|
| **% Contacted < 30 min** | % of leads contacted within 30 minutes of receipt | `ROUND((COUNT WHERE contact_range = '(a)<30min') / total * 100)` | `leads.contact_range` | ✅ |
| **No Contact Attempt** | Count of leads where no contact was ever made | `COUNT WHERE contact_range = 'NO CONTACT'` or `first_contact_by IS NULL/none AND time_to_first_contact IS NULL` | `leads.contact_range`, `leads.first_contact_by`, `leads.time_to_first_contact` | ✅ |
| **Avg Time to Contact** | Average minutes elapsed before first contact | `AVG(parseTimeToMinutes(time_to_first_contact))` — parsed from text like `"0h 22m"` | `leads.time_to_first_contact` (text) | ⚠️ Stored as raw text; parsing is done in JS — no validated numeric column |
| **Branch Contact %** | % of contacts initiated by the branch (not HRD) | `ROUND((branch_contacts / (branch_contacts + hrd_contacts)) * 100)` | `leads.first_contact_by` | ✅ |
| **HRD Contact %** | % of contacts initiated by HRD | `100 − branch_contact_pct` | `leads.first_contact_by` | ✅ |

---

## 4. Compliance / Activity Metrics

| Metric Name | Definition | How It's Calculated | Data Fields | Schema Status |
|---|---|---|---|---|
| **Enrichment Rate / Comment Rate** | % of leads where BM has submitted a comment | `ROUND((COUNT WHERE enrichment_complete = true) / total * 100)` | `leads.enrichment_complete` | ✅ |
| **Comment Compliance** | % of Cancelled+Unused leads that have a BM comment | `ROUND((leads with enrichment.reason OR enrichment.notes) / total_cancelled_unused * 100)` | `leads.status`, `leads.enrichment` (jsonb subfields: `reason`, `notes`) | ✅ |
| **Cancelled Unreviewed** | Cancelled leads not yet actioned by GM | `COUNT WHERE status = 'Cancelled' AND archived = false AND gm_directive IS NULL` | `leads.status`, `leads.archived`, `leads.gm_directive` | ✅ |
| **Unused Overdue** | Unused leads open longer than 5 days | `COUNT WHERE status = 'Unused' AND days_open > 5` | `leads.status`, `leads.days_open` | ✅ |
| **Enrichment Compliance** | Alias for Enrichment Rate in GM view | Same as Enrichment Rate | `leads.enrichment_complete` | ✅ |
| **Needs Comments Count** | Cancelled/Unused leads lacking any BM comment | `COUNT WHERE status IN ('Cancelled','Unused') AND enrichment.reason IS NULL AND enrichment.notes IS NULL` | `leads.status`, `leads.enrichment` (jsonb) | ✅ |
| **Mismatch Count** | Leads flagged as data mismatches | `COUNT WHERE mismatch = true` | `leads.mismatch` | ✅ |
| **Outstanding Items** | Total leads with any unresolved compliance issue | `UNION(needs_comments_leads, mismatch_leads)` — distinct lead count | `leads.status`, `leads.enrichment`, `leads.mismatch` | ✅ |

---

## 5. Task Metrics

| Metric Name | Definition | How It's Calculated | Data Fields | Schema Status |
|---|---|---|---|---|
| **Open Tasks** | Tasks not yet completed | `COUNT WHERE status != 'Done'` | `tasks.status` | ✅ |
| **Task Completion Rate** | % of tasks completed | `ROUND((COUNT WHERE status = 'Done') / total_tasks * 100)` | `tasks.status` | ✅ |
| **Avg Open Tasks** | Average open task count across a time period | `AVG(open_task_count per time bucket)` — computed from tasks + leads join | `tasks.status`, `tasks.lead_id`, `tasks.created_at` | ⚠️ No pre-aggregated column; fully computed at query time |

---

## 6. Leaderboard / Ranking Metrics

| Metric Name | Definition | How It's Calculated | Data Fields | Schema Status |
|---|---|---|---|---|
| **Rank** | Branch position by conversion rate (descending) | Ordinal position after sorting all branches by `conversion_rate DESC` | Computed from `leads.status`, `leads.branch` | ✅ (no dedicated column; computed) |
| **Quartile** | Performance tier (1 = top 25%, 4 = bottom 25%) | Branches ranked by conversion rate; `quartile = CEIL(rank / total_branches * 4)` | Computed; cached in `branch_managers.quartile` | ⚠️ Cache in `branch_managers` may be stale vs live leads calculation |
| **BM Name** | Branch manager name linked to branch | Lookup via `org_mapping.bm` or `leads.bm_name` | `leads.bm_name`, `org_mapping.bm`, `org_mapping.branch` | ✅ |

---

## 7. Feedback / NPS Metrics

| Metric Name | Definition | How It's Calculated | Data Fields | Schema Status |
|---|---|---|---|---|
| **Avg Rating** | Mean user satisfaction score | `AVG(rating)` | `feedback.rating` (int 1–5) | ✅ |
| **NPS Score** | Net Promoter Score | `(% promoters − % detractors) * 100` where promoters = rating ≥ 4, detractors = rating ≤ 2 | `feedback.rating` | ✅ |
| **Promoters %** | % of respondents rating ≥ 4 | `ROUND((COUNT WHERE rating >= 4) / total * 100)` | `feedback.rating` | ✅ |
| **Detractors %** | % of respondents rating ≤ 2 | `ROUND((COUNT WHERE rating <= 2) / total * 100)` | `feedback.rating` | ✅ |
| **Total Feedback** | Total number of feedback submissions | `COUNT(*)` | `feedback` table | ✅ |
| **Feature Request Upvotes** | Vote count per feature request | `COUNT(*) FROM feature_request_upvotes WHERE feature_request_id = X` | `feature_request_upvotes.feature_request_id`, `feature_request_upvotes.user_id` | ✅ |

---

## 8. Pre-computed Snapshot / Trend Metrics

| Metric Name | Definition | How It's Calculated | Data Fields | Schema Status |
|---|---|---|---|---|
| **Weekly Trend: Conversion Rate** | BM conversion rate by week (trend line) | Stored in `weekly_trends.conversion_rate` on snapshot write | `weekly_trends.conversion_rate`, `weekly_trends.week_start` | ✅ |
| **Weekly Trend: Comment Rate** | BM comment compliance by week | Stored in `weekly_trends.comment_rate` | `weekly_trends.comment_rate` | ✅ |
| **Weekly Trend: Total Leads** | Lead volume by week | Stored in `weekly_trends.total_leads` | `weekly_trends.total_leads` | ✅ |
| **GM Weekly: Cancelled Unreviewed** | GM-view cancelled unreviewed trend | Stored in `weekly_trends.cancelled_unreviewed` | `weekly_trends.cancelled_unreviewed` | ✅ |
| **GM Weekly: Comment Compliance** | GM-view compliance trend | Stored in `weekly_trends.comment_compliance` | `weekly_trends.comment_compliance` | ✅ |
| **GM Weekly: Zone Conversion Rate** | Zone-level conversion trend | Stored in `weekly_trends.zone_conversion_rate` | `weekly_trends.zone_conversion_rate` | ✅ |
| **GM Weekly: Time to Contact** | Time-to-contact breakdown by week | Stored as jsonb in `weekly_trends.time_to_contact` | `weekly_trends.time_to_contact` (jsonb) | ⚠️ Internal jsonb structure not formally typed in schema |
| **GM Weekly: Branch Contact Rate** | Branch % of contacts by week | Stored in `weekly_trends.branch_contact_rate` | `weekly_trends.branch_contact_rate` | ✅ |
| **GM Weekly: HRD Contact Rate** | HRD % of contacts by week | Stored in `weekly_trends.hrd_contact_rate` | `weekly_trends.hrd_contact_rate` | ✅ |
| **Observatory: Monthly/Weekly Volume** | Branch-level rolling volume metrics | Stored as jsonb in `observatory_snapshots.snapshot` | `observatory_snapshots.snapshot` (jsonb) with nested `{total, rented, cancelled, unused, within30, branchContact, totalContact}` | ⚠️ All sub-metrics inside untyped jsonb blob |

---

## Flagged Issues

| # | Metric | Issue |
|---|---|---|
| 1 | **Avg Time to Contact** | `leads.time_to_first_contact` is stored as raw text (e.g. `"0h 22m"`) with no validated numeric column. Parsing happens in JS — any non-standard format silently produces `NaN` and is excluded from the average. |
| 2 | **Quartile** | `branch_managers.quartile` is a cached integer that may be out of sync with live leads data. The dashboard computes quartile on the fly from snapshots, but the `branch_managers` table version could show stale data if the cache isn't refreshed after each upload. |
| 3 | **Comment Rate (date-filtered)** | When filtered by date range, `hasBmActivityInDateRange()` relies on `leads.enrichment_log` (jsonb) having per-entry timestamps. If any enrichment was written without an `enrichment_log` entry (e.g. direct DB updates, migration data), those comments won't count in weekly/trend views — even though `enrichment_complete = true`. |
| 4 | **Avg Open Tasks** | No pre-aggregated column. Fully recomputed at query time by joining `tasks` and filtering by date. Performance risk at scale; also susceptible to definition drift if `tasks.created_at` vs `tasks.due_date` is used inconsistently for bucketing. |
| 5 | **weekly_trends.time_to_contact** | Stored as untyped `jsonb` with no schema contract. If the snapshot writer changes the internal keys (e.g. `avg_minutes` → `avgMinutes`), the frontend silently breaks without a DB migration. |
| 6 | **observatory_snapshots.snapshot** | Entire observatory metric set is a single jsonb blob — `{total, rented, cancelled, unused, within30, branchContact, totalContact}` per bucket. No typed columns, no DB-level validation. Schema drift between snapshot writer and frontend reader is a silent failure mode. |
| 7 | **dashboard_snapshots.snapshot** | Entire pre-computed dashboard state is one jsonb blob. If any field is renamed or restructured in `services/snapshot.py`, old snapshots served to the frontend will be missing fields with no error surfaced at the DB layer. |

---

## Calculation Pipeline Summary

```
User views dashboard
  └─ GET /api/dashboard-snapshot
       └─ Returns pre-computed JSONB from dashboard_snapshots table
            └─ Frontend renders BM/GM stats, leaderboard, chart data

For drilldowns / filtered views
  └─ GET /api/leads  (with filters: branch, date range, status, etc.)
  └─ GET /api/tasks
       └─ demoSelectors.js computes metrics client-side

When lead data is updated (HLES upload)
  └─ POST /api/upload  →  ETL writes to leads table
       └─ services/snapshot.py recomputes all metrics
            └─ Stores full dashboard state in dashboard_snapshots.snapshot (jsonb)
       └─ services/observatory_snapshot.py recomputes 12-month/12-week windows
            └─ Stores in observatory_snapshots.snapshot (jsonb)
```

### Key Field Notes

| Field | Notes |
|---|---|
| `leads.contact_range` | Populated during ETL upload. Values: `"(a)<30min"` or `"NO CONTACT"`. |
| `leads.time_to_first_contact` | Raw text (`"0h 22m"`). Parsed to minutes in JS with `parseTimeToMinutes()`. |
| `leads.first_contact_by` | Values: `"branch"`, `"hrd"`, or `"none"`. |
| `leads.enrichment` | jsonb `{reason: string, notes: string}`. BM comment content. |
| `leads.enrichment_log` | jsonb array of `{timestamp, ...}` entries. Required for date-ranged comment filtering. |
| `leads.init_dt_final` | Lead received date. Used as the primary date axis for all time filters. |
| `leads.days_open` | Calculated during ETL. Integer days since `init_dt_final`. |
| `branch_managers.quartile` | Cached from last snapshot run. May lag live data. |
