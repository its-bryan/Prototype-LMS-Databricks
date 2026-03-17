# TRANSLOG Handling — Plan (Deferred)

> **Status**: Deferred. TRANSLOG is not uploaded by the app; it already lives in the data platform. This doc captures the target design for when we implement it.

---

## Source of truth (no upload)

- **We do not upload TRANSLOG** in the LMS app. TRANSLOG data already exists in the data platform:
  - **Delta table**: `hdp.hdp_bronze.hles_translog`
  - This table is huge; it is the canonical source for translog/activity events.

- **Implications**:
  - Remove or repurpose TRANSLOG file upload (Admin UI + `POST /api/upload/translog`) and TRANSLOG Volume landing (`translog_landing_prod`) when we implement this plan.
  - No ETL from Excel into our DB for translog; no storage of translog events in Lakebase Postgres.

---

## Target design: no storage in our tables, cache + query Delta on demand

We **do not store** any translog data in our own tables (no `leads.translog` JSONB, no separate translog table in Postgres). Our DB stays lean.

**Flow:**

1. **User asks to see TRANSLOG for a lead**  
   e.g. opens lead detail and expands “Activity” / “Translog timeline”.

2. **App checks cache**  
   In-memory (or Redis, etc.) cache keyed by lead identifier (e.g. `confirm_num`). If we have recent translog for that lead, return it.

3. **On cache miss: query Delta**  
   Query `hdp.hdp_bronze.hles_translog` for that lead (join key TBD: likely `confirm_num` or whatever column in `hles_translog` maps to our lead). Use Databricks SQL warehouse or a small server-side job to run the query; return the event list to the API.

4. **Optionally cache the result**  
   Store the returned events in the cache (with TTL) so repeat views for the same lead are fast without hitting Delta again.

5. **Frontend**  
   Existing UI (e.g. TranslogTimeline) receives the event list from a dedicated endpoint (e.g. `GET /api/leads/:id/translog` or `GET /api/leads/:id/activities`) that implements the cache + Delta query above. List/dashboard APIs do **not** include translog; translog is fetched only when the user asks to see it for a specific lead.

---

## Benefits

- **No translog in our DB** — No row bloat on `leads`, no separate translog table to maintain; Lakebase Postgres stays small and fast.
- **Single source of truth** — `hdp.hdp_bronze.hles_translog` is the only place translog lives; no sync or dual write.
- **Scalable** — Delta handles the huge table; we only query a slice per lead when needed.
- **Acceptable latency** — Cache makes repeat views fast; first view may be slower (Delta query) unless we warm the cache or keep the SQL warehouse warm.

---

## To confirm when implementing

- **Schema of `hdp.hdp_bronze.hles_translog`** — Column names and types; which column(s) to use to filter by lead (e.g. `confirm_num`, `reservation_id`, or another key).
- **How the app queries Delta** — Databricks SQL warehouse from the backend (REST API / SDK), or a small job, and how to pass the lead identifier and map the result to the shape the frontend expects (time, event type, outcome, etc.).
- **Cache** — Where (in-memory vs Redis), TTL, and key (e.g. `confirm_num` or `lead_id`).
- **Endpoint** — e.g. `GET /api/leads/:id/translog` or `GET /api/leads/:id/activities` returning `{ "events": [ ... ] }` for the timeline.
- **`leads.translog` and `last_activity`** — Today the frontend and selectors use `lead.translog` and `lead.lastActivity`. When we implement this plan we will either: stop returning `translog` from GET lead (and have the UI fetch from the new endpoint), and derive `last_activity` from Delta or a lightweight summary (e.g. one query for “latest event time per lead” or a materialized view in Delta) if we still need it on the lead row for list views.

---

## References

- Current (to be deprecated for translog): `leads.translog` in `docs/lakebase-migrations/001_full_schema.sql`
- Current upload (to remove/repurpose): `routers/upload.py` — `upload_translog`, TRANSLOG Volume landing
- ETL (used only for upload path): `etl/clean.py` — `clean_translog_data`
- Frontend: `TranslogTimeline`, `LeadDetail`, selectors using `lead.translog` / `lastActivity`
- Volume doc: `docs/VOLUME-LANDING-BEHAVIOR.md` (TRANSLOG landing section will be obsolete once we rely only on `hdp.hdp_bronze.hles_translog`)
