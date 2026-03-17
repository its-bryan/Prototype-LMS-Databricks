# Handoff Brief: ETL Fix + Phase 2 Completion

> **Date**: 2026-03-17
> **Status**: **ETL Phase 2 complete.** Migration 004 run in Lakebase; ETL fixed; communication stripped; directive/enrichment/contact return full row; cdp_name bug fixed in upload; app redeployed. **Architect recommendation (Volume staging) reviewed and documented below.**
> **Priority**: Test HLES upload end-to-end → verify Phase 2 (directives, wins, compliance) → then PROD-READY items when moving to production.

---

## What's Done

### Database (Lakebase Postgres — 13 tables)
- All tables created and working in `databricks_postgres` database
- Schema: `001_full_schema.sql` (11 tables) + `003_phase2_tables.sql` (2 tables: `gm_directives`, `wins_learnings`)
- Seed data: `002_seed_config.sql` — org_mapping (15 demo branches), cancel reasons, next actions, demo user profiles
- 5 test leads inserted manually for testing Phase 2 features
- App has GRANT access to all tables via DATABRICKS_CLIENT_ID

### Backend (FastAPI)
- All endpoints working: leads, tasks, config, upload, directives, wins
- Connection uses psycopg3 + OAuth token rotation (see `DatabricksLearnings.md`)
- Phase 2 endpoints:
  - `GET/POST /api/leads/{id}/directives` — GM directives per lead
  - `GET/POST /api/wins-learnings` — wins & learnings submissions
  - `POST /api/tasks/compliance` — bulk compliance task creation

### Frontend (React)
- `databricksData.js` — all stubs replaced with real API calls
- Hardcoded to use Databricks backend (no build flags needed)
- `npm run build` required after frontend changes, then redeploy

### Deployment
- Databricks Apps with Database resource configured
- Push process: `git subtree split --prefix=docs/Prototype-LeadMgmtsys/prototype-lms` then push to both `prototype-lms` and `prototype-lms-databricks` remotes (NEVER push full repo)
- See `DatabricksLearnings.md` for full deployment workflow

---

## Solution Architect Recommendation: Volume-Based Staging (Plan Double-Check)

A Databricks solution architect suggested introducing a **staging layer** before loading into Postgres:

1. **Land Excel in Unity Catalog**  
   Create **Volumes** (or volume-backed locations) inside a **Catalogue** (Unity Catalog). Users paste or upload Excel files there instead of (or in addition to) uploading via the app.

2. **Parse from Volume → Postgres**  
   A separate process (scheduled job or triggered pipeline) reads the Excel files from the Volume, runs the same ETL logic (column mapping, cleaning), and inserts/updates the **Lakebase Postgres** `leads` table.

### Terminology Clarification

- **“Volume tables”** in this context means **Unity Catalog Volumes** — governed storage for non-tabular data (e.g. `.xlsx` files). Volumes live under a catalog/schema (e.g. `catalog.schema.volume_name`). Optionally you can have a **table** (e.g. Delta or external) that tracks which files landed in the volume.
- **“Data parsed into Postgres”** = the same target as today: **Lakebase Postgres** (`databricks_postgres`), i.e. the existing `leads` (and related) tables. The architect is not replacing Postgres; they are adding a governed landing zone (Volume) before load.

### Current Plan vs Architect’s Proposal

| Aspect | Current handoff (this doc) | Architect’s proposal |
|--------|----------------------------|----------------------|
| **Landing** | Excel uploaded via app → FastAPI receives file in memory | Excel lands in a Unity Catalog **Volume** (paste/upload into catalogue) |
| **ETL** | `etl/clean.py` + `routers/upload.py`: read from bytes, clean, map columns | Same ETL logic, but **input** = read from Volume path (e.g. `dbfs:/Volumes/catalog/schema/volume/file.xlsx`) |
| **Target** | Lakebase Postgres `leads` table | Same — Lakebase Postgres `leads` table |
| **Trigger** | User clicks Upload in app | Job/pipeline (scheduled or file-triggered) runs after files land in Volume |

### Plan double-check — Conclusion

- **The handoff plan is correct** for the current scope: ETL mappings, `leads` columns, and upload router all target Lakebase Postgres. The architect’s idea does **not** change the target or the ETL logic; it adds a **governed landing stage** (Volume) and moves “where the file comes from” from “app upload” to “file in Volume”.
- **Compatibility**: The same `clean_hles_data()` (and column mappings) in `etl/clean.py` can be reused whether the Excel is read from in-memory bytes (app upload) or from a path in a Volume. Only the **source** of the bytes changes (FastAPI `UploadFile` vs `pd.read_excel(volume_path)` or equivalent).
- **If you adopt the Volume approach later**:  
  - Create a Volume (and optional metadata table) in your Unity Catalog catalogue.  
  - Add a job (Notebook or Python job) that lists new files in the Volume, runs `clean_hles_data()` on each, and performs the same INSERT/UPDATE to Postgres as `routers/upload.py` does today.  
  - Optionally keep the app upload path as a convenience; both can write to the same Postgres tables.

**Note**: Writing Excel *to* a Unity Catalog Volume from code has a [known limitation](https://kb.databricks.com/en_US/unity-catalog/trying-to-write-excel-files-to-a-unity-catalog-volume-fails) (no direct-append). Workaround: write to local disk first, then copy into the Volume. Reading Excel *from* a Volume (for the parse → Postgres step) is supported.

---

## Business semantics (2026-03-17) — Confirmation Number as UUID

- **Unique identifier (UUID)** = **CONFIRM_NUM** (Confirmation Number). Match/upsert leads by `confirm_num`. The DB column `reservation_id` is set to `confirm_num` for display ("Reservation #" in the UI).
- **Customer** = **RENTER_LAST** only (Customer Last Name). Not ADJ FNAME/LNAME.
- **ADJ FNAME / ADJ LNAME** = Insurance adjuster names (not the customer).
- **RES_ID** = Always 1 in the file (reservation = true). Not used as an identifier. Omitted from ETL key and from required fields.

See **docs/PLAN-CONFIRM-NUM-AS-UUID.md** for the full change plan and migration 005.

---

## What Needs Fixing: ETL

### The Problem

The HLES upload ETL (`etl/clean.py` + `routers/upload.py`) doesn't match the actual HLES Excel file format. The column names, mappings, and the set of fields inserted into the `leads` table are all incomplete.

### Actual HLES File Format

File: `data/raw/HLES Conversion Data 2025.06.09 - 1000 records.xlsx`

Columns (with leading `\n` characters from Excel formatting):
```
\nCONFIRM_NUM    — Confirmation number (e.g., "208-9441926")
\nCLAIM          — Claim number
\nCDP            — CDP code
\nCDP NAME       — Insurance company name (e.g., "COOPERATORS (CGIC) HIRS")
\nWeek Of        — Week date
\nINIT_DATE       — Initial date
\nHTZREGION      — Hertz region (e.g., "Canada")
\nSET_STATE      — State/province (e.g., "AB")
\nZONE           — Zone (e.g., "Canada")
\nAREA_MGR       — Area manager name
\nGENERAL_MGR    — General manager name
\nRENT_LOC       — Rental location / branch (e.g., "8036-25    - EDMONTON SOUTH")
\nRES_ID         — Reservation ID (primary identifier)
\nRENT_IND       — Rental indicator: 1=Rented, 0=Not rented
\nCANCEL_ID      — Cancel indicator
\nUNUSED_IND     — Unused indicator
\nCONTACT_GROUP  — Contact group (e.g., "COUNTER")
\nCONTACT RANGE  — Time to contact range (e.g., "(c)1-3 hrs")
\nADJ LNAME      — Customer last name
\nADJ FNAME      — Customer first name
\nBODY SHOP      — Body shop name
\nCODE           — Country code
\nKNUM           — K-number
\nMONTH          — Month (YYYYMM format)
\nZIP            — ZIP/postal code
\nCANCEL REASON  — Cancellation reason text
\nINIT_DT_FINAL  — Final initial date (date reservation was received)
FST\nDT_FROM_ALPHA1 — First contact datetime
\nDAY_DIF        — Days difference
\nHRS_DIF        — Hours difference
\nMIN_DIF        — Minutes difference
\nDATE_OUT1      — Date out
```

**Important**: Column names have leading `\n` characters. The ETL's regex normalization (`re.sub(r'\s+', '_', col.strip().lower())`) converts these to clean lowercase_underscore format (e.g., `\nCONFIRM_NUM` → `confirm_num`, `\nADJ LNAME` → `adj_lname`).

### Current ETL Mappings (etl/clean.py)

```python
col_map = {
    'res_id': 'reservation_id',        # ✓ Works
    'cust_name': 'customer',            # ✗ Column doesn't exist in HLES
    'cust_nm': 'customer',              # ✗ Column doesn't exist in HLES
    'br_name': 'branch',               # ✗ Column doesn't exist in HLES
    'branch_name': 'branch',            # ✗ Column doesn't exist in HLES
    'bm': 'bm_name',                   # ✗ Column doesn't exist in HLES
    'branch_manager': 'bm_name',        # ✗ Column doesn't exist in HLES
    'ins_co': 'insurance_company',      # ✗ Column doesn't exist in HLES
    'insurance': 'insurance_company',   # ✗ Column doesn't exist in HLES
    'cancel_reason': 'hles_reason',     # ✓ Works
    'reason': 'hles_reason',            # (fallback, fine)
    'rent_ind': 'rent_ind',             # ✓ Works
    'init_dt_final': 'init_dt_final',   # ✓ Works
}
```

### Required ETL Mappings

After column normalization, the HLES columns become:
```python
col_map = {
    'res_id': 'reservation_id',
    'confirm_num': 'confirm_num',
    'cdp_name': 'insurance_company',        # "CDP NAME" = insurance company
    'rent_loc': 'branch',                   # "RENT_LOC" = branch/location
    'general_mgr': 'general_mgr',
    'area_mgr': 'area_mgr',
    'zone': 'zone',
    'htzregion': 'htz_region',
    'set_state': 'set_state',
    'cancel_reason': 'hles_reason',
    'rent_ind': 'rent_ind',
    'init_dt_final': 'init_dt_final',
    'week_of': 'week_of',
    'contact_range': 'contact_range',
    'body_shop': 'body_shop',
    'knum': 'knum',
}

# Customer name: combine ADJ FNAME + ADJ LNAME
df['customer'] = (df['adj_fname'].fillna('') + ' ' + df['adj_lname'].fillna('')).str.strip()

# BM name: look up from org_mapping table by branch, or leave empty
# (HLES doesn't have BM — only GENERAL_MGR and AREA_MGR)
```

### Leads Table — Missing Columns

The `leads` table (from `001_full_schema.sql`) is missing these columns that the frontend's `leadFromRow` in `databricksData.js` already expects:

```sql
-- Add to leads table:
ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirm_num text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS knum text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_email text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_phone text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_status text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS body_shop text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mismatch_reason text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cdp_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS htz_region text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS set_state text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zone text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS area_mgr text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS general_mgr text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rent_loc text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS week_of date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_range text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_upload_id bigint;
```

Run these ALTER TABLEs in the Lakebase SQL editor, then GRANT access if needed.

### Upload Router — Needs More Fields

`routers/upload.py` currently only inserts 8 fields. After fixing the ETL and adding columns, update the INSERT to include all mapped fields.

Current INSERT (upload.py line 41-49):
```python
execute(
    """INSERT INTO leads
        (customer, reservation_id, status, branch, bm_name,
         insurance_company, hles_reason, init_dt_final)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
    (...)
)
```

Needs to become:
```python
execute(
    """INSERT INTO leads
        (customer, reservation_id, status, branch, bm_name,
         insurance_company, hles_reason, init_dt_final,
         confirm_num, knum, body_shop, cdp_name, htz_region,
         set_state, zone, area_mgr, general_mgr, rent_loc,
         week_of, contact_range)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
    (...)
)
```

Similarly update the UPDATE statement for existing leads.

### BM Name Resolution

The HLES file doesn't contain BM names — only `GENERAL_MGR` and `AREA_MGR`. The `bm_name` field (which is `NOT NULL` in the leads table) needs to be resolved by looking up the org_mapping table by branch. If no match, use a fallback like the area manager name or empty string.

Two approaches:
1. Look up `org_mapping` during ETL: `SELECT bm FROM org_mapping WHERE branch = %s`
2. Change `bm_name` to nullable in the leads table: `ALTER TABLE leads ALTER COLUMN bm_name DROP NOT NULL;`

Option 2 is simpler for now.

---

## Files to Modify

| File | What to change |
|------|---------------|
| `etl/clean.py` | Fix column mappings to match actual HLES format, add customer name concatenation |
| `routers/upload.py` | Add all new fields to INSERT/UPDATE statements |
| `lakebase-migrations/004_add_lead_columns.sql` | New migration: ALTER TABLE leads ADD COLUMN for missing fields |

## Files for Reference

| File | Contains |
|------|----------|
| `DatabricksLearnings.md` | Lakebase connection patterns, deployment workflow, gotchas |
| `PROD-READY.md` | Production readiness checklist |
| `lakebase-migrations/001_full_schema.sql` | Current leads table schema |
| `lakebase-migrations/003_phase2_tables.sql` | GM directives + wins/learnings tables |
| `src/data/databricksData.js` | Frontend data layer — `leadFromRow` shows all expected fields |
| `src/context/DataContext.jsx` | How the frontend consumes the data functions |
| `data/raw/HLES Conversion Data 2025.06.09 - 1000 records.xlsx` | Sample HLES file for testing |
| `CLAUDE.md` (root) | Project overview, data domain glossary, conversion variable definition |
| `docs/Prototype-LeadMgmtsys/CLAUDE.md` | Prototype architecture, push instructions, tech stack |

## Key Domain Context

- **RENT_IND**: `1` = converted (Rented), `0` = not converted. Formula: `Conversion Rate = sum(RENT_IND) / count(RES_ID) × 100%`
- **HLES**: Hertz Lead Entry System — source of lead data via EDI
- **Lead statuses**: Rented | Cancelled | Unused | Reviewed
- **Org hierarchy**: BM (Branch Manager) → Branch → AM (Area Manager) → GM (General Manager) → Zone
- The `branch` field in the HLES data is `RENT_LOC` which looks like `"8036-25    - EDMONTON SOUTH"` — may need cleaning to match org_mapping

## Testing Plan

1. Run ALTER TABLE migration in Lakebase SQL editor
2. Update `etl/clean.py` with correct mappings
3. Update `routers/upload.py` with all fields
4. Push to both remotes via subtree split
5. Pull + rebuild + redeploy on Hertz laptop
6. Test: upload the HLES file via Admin → Upload view
7. Verify leads appear in the app with correct data
8. Test Phase 2 features against real leads:
   - GM Directives: open a lead as GM, submit a directive
   - Wins & Learnings: submit as BM from Meeting Prep
   - Compliance Tasks: create bulk tasks for a branch as GM

## Deployment Reminder

```bash
# From HertzDataAnalysis repo root — NEVER push full repo
git subtree split --prefix=docs/Prototype-LeadMgmtsys/prototype-lms -b prototype-only
git push prototype-lms prototype-only:main --force
git push prototype-lms-databricks prototype-only:main --force
git branch -D prototype-only
```

## Simplification: Remove Email / SMS / Call Features

The prototype currently has full send-email, send-SMS, and initiate-call functionality (via Supabase Edge Functions). These need to be **removed or excluded from the build** to simplify the prototype before the next round of stakeholder demos.

### Files to DELETE

| File | What it does |
|------|-------------|
| `src/components/EmailComposeModal.jsx` | Email compose modal with 4 templates |
| `src/components/SmsComposeModal.jsx` | SMS compose modal with 4 templates + character counter |
| `src/components/ContactButtons.jsx` | **Orchestrator** — calls Supabase Edge Functions: `send-email`, `send-sms`, `initiate-call` |
| `src/components/UpcomingCommunications.jsx` | Displays scheduled automated emails/SMS |
| `src/config/communicationRules.js` | All automated communication triggers & templates (10 rules) |

### Files to MODIFY (remove imports + usage)

| File | What to remove |
|------|---------------|
| `src/components/interactive/InteractiveLeadDetail.jsx` | Remove `ContactButtons`, `UpcomingCommunications` imports; remove `contactButtonsSlot` and `upcomingCommsSlot` passed to `LeadDetail` |
| `src/components/interactive/MeetingPrepLeadPanel.jsx` | Same — remove `ContactButtons`, `UpcomingCommunications` imports + slots |
| `src/selectors/demoSelectors.js` | Remove `COMMUNICATION_RULES`, `EMAIL_TEMPLATES`, `SMS_TEMPLATES` imports; remove `getUpcomingCommunications()` function |
| `src/components/ProfileView.jsx` | Remove `PhoneInput` import + agent phone setup UI |

### Files to DECIDE (keep or remove)

| File | Notes |
|------|-------|
| `src/components/PhoneInput.jsx` | Phone input + `parsePhoneE164`/`formatLocalDisplay` utilities. Used by `ContactButtons` (being removed) and `LeadContactCard` (contact editing). Keep if you still want phone display/editing on leads. |
| `src/components/LeadContactCard.jsx` | Displays/edits lead email + phone. Not a sender itself. Probably keep. |

### Files that are SAFE (no changes needed)

| File | Why it's fine |
|------|--------------|
| `src/components/LeadDetail.jsx` | Receives communication components via optional slot props — won't break when slots aren't passed |
| `src/data/contactParsers.js` | Data parsing utility for HLES/TRANSLOG import — not communication-specific |

### Dependency Map

```
EmailComposeModal ─┐
SmsComposeModal  ──┤
PhoneInput ────────┤── imported by ContactButtons (ORCHESTRATOR)
                   │     └── calls supabase.functions.invoke("send-email"|"send-sms"|"initiate-call")
                   │
ContactButtons ────┤── imported by InteractiveLeadDetail, MeetingPrepLeadPanel
UpcomingCommunications ── imported by InteractiveLeadDetail, MeetingPrepLeadPanel
communicationRules.js ── imported by demoSelectors.js
```

---

## Post-ETL Tasks (from PROD-READY.md)

- Delete test leads: `DELETE FROM leads WHERE reservation_id LIKE 'RES-TEST-%';`
- Delete demo seed data (org_mapping, user_profiles) before production
- Load real org mapping from client
- Create real user profiles linked to Databricks/SSO IDs
- Test TRANSLOG upload with real data
- Replace demo role picker with real authentication

---

## Changelog: 2026-03-17 — ETL Fix + Communication Removal

All items from the "What Needs Fixing" section above have been completed. Summary:

### Migration 004 — `docs/lakebase-migrations/004_add_lead_columns.sql` (NEW)
- Added 17 columns to `leads` table: `confirm_num`, `knum`, `body_shop`, `cdp_name`, `htz_region`, `set_state`, `zone`, `area_mgr`, `general_mgr`, `rent_loc`, `week_of`, `contact_range`, `source_email`, `source_phone`, `source_status`, `mismatch_reason`, `last_upload_id`
- Made `bm_name` nullable (`DROP NOT NULL`) — HLES has no BM column; resolved via org_mapping lookup at ETL time
- Added indexes on `zone`, `week_of`, `general_mgr`
- **Status**: Script created. Must be run in Lakebase SQL editor before deploying.

### ETL Fix — `etl/clean.py`
- Replaced all incorrect column mappings (`cust_name`, `br_name`, `bm`, `ins_co`) with actual HLES columns after normalization (`cdp_name` → `insurance_company`, `rent_loc` → `branch`, etc.)
- Added customer name concatenation: `adj_fname` + `adj_lname` → `customer`
- Added `org_lookup` parameter: ETL now accepts a `dict[branch, bm_name]` from org_mapping for BM name resolution
- Maps all 16 HLES fields into the leads table

### Upload Router — `routers/upload.py`
- Expanded INSERT from 8 fields to 20 fields
- Expanded UPDATE to include all new fields
- Added `_build_org_lookup()` — queries `org_mapping` table at upload time to resolve BM names by branch
- Added `_val()` helper — safely converts pandas NaN/NaT to Python None for psycopg3
- Added per-row try/except with `failed` counter in upload stats

### Bug Fixes — `routers/leads.py`
- **`PUT /leads/{id}/directive`** — was returning `{"ok": true}`, causing `leadFromRow({"ok": true})` to produce a broken lead object in React state. Now returns `SELECT * FROM leads WHERE id = %s` (full row).
- **`PUT /leads/{id}/enrichment`** — same fix. Returns full lead row.
- **`PUT /leads/{id}/contact`** — same fix. Returns full lead row.

### Communication Feature Removal — 5 files deleted, 4 files cleaned

**Deleted:**
| File | What it was |
|------|-------------|
| `src/components/EmailComposeModal.jsx` | Email compose modal (4 templates) |
| `src/components/SmsComposeModal.jsx` | SMS compose modal (4 templates + char counter) |
| `src/components/ContactButtons.jsx` | Orchestrator — Supabase edge function calls |
| `src/components/UpcomingCommunications.jsx` | Scheduled comms display |
| `src/config/communicationRules.js` | Automated communication triggers (10 rules) |

**Cleaned:**
| File | What was removed |
|------|-----------------|
| `InteractiveLeadDetail.jsx` | `ContactButtons`, `UpcomingCommunications` imports + slot props + activity loading code + `useAuth` |
| `MeetingPrepLeadPanel.jsx` | Same — plus removed `useAuth` import, `contactActivities` state, `loadActivities` callback |
| `demoSelectors.js` | `COMMUNICATION_RULES`/`EMAIL_TEMPLATES`/`SMS_TEMPLATES` imports + entire `getUpcomingCommunications()` function (~80 lines) |
| `ProfileView.jsx` | `PhoneInput` import + agent phone setup UI section |

**Kept (as planned):**
- `PhoneInput.jsx` — still used by `LeadContactCard` for contact editing
- `LeadContactCard.jsx` — displays/edits lead contact info, not a sender
- `LeadDetail.jsx` — slot props are optional, works fine without them
- `contactParsers.js` — data utility, not communication-specific

### What Remains (post–Phase 2)

1. ~~**Run migration 004**~~ — Done (run in Lakebase SQL editor).
2. ~~**Push & deploy**~~ — Repo now deploys from **Prototype-LMS-Databricks** via `databricks repos update` + `databricks apps deploy` (see `DatabricksLearnings.md`). No subtree split.
3. **Test HLES upload** via Admin → Upload view with a real/sample HLES file.
4. **Verify Phase 2 features** against real leads: GM directives, wins & learnings, compliance tasks.
5. **Clean test data** when ready: `DELETE FROM leads WHERE reservation_id LIKE 'RES-TEST-%';`
6. Before production: see **PROD-READY.md** (seed data cleanup, real org mapping, auth, known bugs).
