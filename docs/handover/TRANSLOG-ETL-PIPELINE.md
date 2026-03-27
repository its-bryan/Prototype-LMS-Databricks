# TRANSLOG ETL Pipeline — Comprehensive Handover

> **Status**: Implemented & Active
> **Last Updated**: 2026-03-27
> **Supersedes**: `docs/TRANSLOG-Handling.md` (which described the deferred Delta-cache design — we pivoted to a normalized Postgres table approach)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Database Schema](#3-database-schema)
4. [ETL Pipeline — Data Ingestion](#4-etl-pipeline--data-ingestion)
5. [Lead Joining Logic](#5-lead-joining-logic)
6. [Filtering Logic — Noise vs. Actionable Insights](#6-filtering-logic--noise-vs-actionable-insights)
7. [Humanization Layer](#7-humanization-layer)
8. [API Endpoints](#8-api-endpoints)
9. [Frontend Components](#9-frontend-components)
10. [Orphan Reconciliation](#10-orphan-reconciliation)
11. [File Map](#11-file-map)

---

## 1. Executive Summary

The TRANSLOG pipeline ingests raw event data from the HLES (Hertz Local Edition System) into our Lakebase Postgres database, links each event to its corresponding lead, filters out operational noise, categorizes events into actionable groups, and presents them to BMs/GMs as a human-readable activity timeline on each lead.

**Key design decisions:**
- **Normalized relational table** (`translog_events`) instead of JSONB on the leads row — enables indexing, filtering, and orphan management
- **Dual-key linkage** — `knum` (primary) and `rez_num → confirm_num` (secondary) to maximize lead matching
- **Role-based filtering** — BMs/GMs see only curated, actionable events; Admins see everything
- **Orphan reconciliation** — Unmatched events are preserved and can be manually or automatically linked later

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW DIAGRAM                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐    │
│  │  Databricks   │    │  ETL Scripts  │    │  Lakebase Postgres │    │
│  │  Delta Table  │───▶│  (Python)     │───▶│  translog_events   │    │
│  │  hles_translog│    │              │    │                    │    │
│  └──────────────┘    └──────┬───────┘    └────────┬───────────┘    │
│                             │                      │                │
│                    ┌────────▼────────┐    ┌────────▼───────────┐    │
│                    │  etl/clean.py   │    │  Dual-Key Linkage  │    │
│                    │  • Parse HLES   │    │  knum → leads.knum │    │
│                    │    timestamps   │    │  rez_num → leads.  │    │
│                    │  • Clean text   │    │    confirm_num      │    │
│                    │  • Validate     │    │  NULL = orphan      │    │
│                    └─────────────────┘    └────────┬───────────┘    │
│                                                    │                │
│                                           ┌────────▼───────────┐    │
│                                           │  FastAPI Router    │    │
│                                           │  /leads/{id}/      │    │
│                                           │    translog        │    │
│                                           │  /translog/stats   │    │
│                                           │  /translog/orphans │    │
│                                           └────────┬───────────┘    │
│                                                    │                │
│                              ┌─────────────────────┼───────────┐    │
│                              │                     │           │    │
│                     ┌────────▼──────┐    ┌─────────▼────────┐  │    │
│                     │ Translog      │    │ Translog Admin   │  │    │
│                     │ Timeline      │    │ (Orphan Mgmt)    │  │    │
│                     │ (BM/GM view)  │    │ (Admin only)     │  │    │
│                     └───────────────┘    └──────────────────┘  │    │
│                              │                                 │    │
│                     ┌────────▼──────────────────────────────┐  │    │
│                     │  Role-Based Filtering                 │  │    │
│                     │  • BM/GM: Loc-, Rez-, R/A whitelist   │  │    │
│                     │  • Admin: All raw events              │  │    │
│                     └───────────────────────────────────────┘  │    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 New Table: `translog_events`

> Migration: `docs/lakebase-migrations/020_translog_events.sql`

```sql
CREATE TABLE translog_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- ── Linkage keys ──────────────────────────────
  source_id     bigint,         -- Original row ID from Databricks
  lead_id       bigint          -- FK → leads(id), NULL = orphan
                REFERENCES leads(id) ON DELETE SET NULL,
  knum          text,           -- Primary join key → leads.knum
  rez_num       text,           -- Secondary join key → leads.confirm_num
  confirm_num   text,           -- Confirmation number (rarely populated)

  -- ── Location ──────────────────────────────────
  loc_code      text,           -- Branch/location code

  -- ── Timestamps ────────────────────────────────
  system_date      timestamptz, -- When recorded in HLES
  application_date timestamptz, -- When event actually occurred

  -- ── Event classification ──────────────────────
  event_type    smallint,       -- 0–6 category code
  bgn01         text,           -- Sub-type code
  stat_flag     text,           -- Status flag (A, 9, 1, 2…)
  sf_trans      text,           -- Transaction reference

  -- ── Event description (MSG fields) ────────────
  msg1  text,   -- Primary description (e.g. "Loc-Customer Contact")
  msg2  text,   -- Secondary detail / outcome
  msg3  text,   -- Additional detail
  msg4  text,   -- Follow-up info
  msg5  text,   -- Application/version
  msg6  text,   -- Employee/entity name
  msg7  text,
  msg8  text,
  msg9  text,
  msg10 text,   -- Extended detail / CDP / MMR info

  -- ── Employee attribution ──────────────────────
  emp_code  text,
  emp_lname text,
  emp_fname text,

  -- ── Operational ───────────────────────────────
  requested_days  int DEFAULT 0,
  timezone_offset smallint DEFAULT 0,

  -- ── Databricks metadata ───────────────────────
  load_date      date,
  source_system  text,          -- e.g. "HLES"
  source_region  text,          -- e.g. "USA"

  -- ── Audit ─────────────────────────────────────
  created_at timestamptz DEFAULT now()
);
```

**Performance Indexes:**

| Index | Column(s) | Purpose |
|-------|-----------|---------|
| `idx_translog_events_knum` | `knum` | Reservation lookups / lead joins |
| `idx_translog_events_lead_id` | `lead_id` | Lead detail queries |
| `idx_translog_events_loc_code` | `loc_code` | Branch filtering |
| `idx_translog_events_system_date` | `system_date` | Timeline sorting |
| `idx_translog_events_msg1` | `msg1` | Event type filtering |
| `idx_translog_events_orphan` | `lead_id` WHERE NULL | Orphan-specific queries |
| `idx_translog_events_source_id` | `source_id` | Deduplication on reload |

### 3.2 Amendment to `leads` Table

> Migration: `docs/lakebase-migrations/021_add_leads_mmr.sql`

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mmr text;
```

The `mmr` column stores the MMR (Monthly Market Rate) flag extracted from translog `msg10` fields. This surfaces on the lead card so BMs/GMs can see MMR status without drilling into the translog timeline.

### 3.3 Schema Relationship Diagram

```
┌────────────────────────┐          ┌─────────────────────────┐
│        leads           │          │    translog_events       │
├────────────────────────┤          ├─────────────────────────┤
│ id (PK)                │◀─────┐  │ id (PK)                 │
│ knum                   │◀──┐  │  │ source_id               │
│ confirm_num            │◀┐ │  └──│ lead_id (FK → leads.id) │
│ mmr (NEW)              │ │ │     │ knum ─────────────────┐  │
│ customer               │ │ └─────│    (join → leads.knum)│  │
│ branch                 │ └───────│ rez_num ──────────────┘  │
│ bm_name                │        │    (join → leads.        │
│ gm_name                │        │     confirm_num)         │
│ status                 │        │ loc_code                 │
│ ...                    │        │ system_date              │
└────────────────────────┘        │ msg1 … msg10             │
                                  │ emp_code, emp_fname/lname│
                                  │ ...                      │
                                  └─────────────────────────┘

  Join Strategy:
  ─────────────
  PRIMARY:   translog_events.knum = leads.knum
  SECONDARY: translog_events.rez_num = leads.confirm_num
  ORPHAN:    lead_id IS NULL (no match found)
```

---

## 4. ETL Pipeline — Data Ingestion

### 4.1 Pipeline Overview

```
  Databricks CSV Export
  (hles_translog)
         │
         ▼
  ┌──────────────────────────────────────────┐
  │  STEP 1: Parse & Clean (etl/clean.py)    │
  │  • YYYYMMDDHHMMSS → UTC timestamps      │
  │  • Rename 40 Databricks columns → schema │
  │  • Clean nulls, parse numerics           │
  └────────────────┬─────────────────────────┘
                   │
                   ▼
  ┌──────────────────────────────────────────┐
  │  STEP 2: Link to Leads                   │
  │  • Build in-memory lookup maps           │
  │  • knum → lead_id (primary)              │
  │  • rez_num → lead_id via confirm_num     │
  │  • Unmatched → lead_id = NULL (orphan)   │
  └────────────────┬─────────────────────────┘
                   │
                   ▼
  ┌──────────────────────────────────────────┐
  │  STEP 3: Bulk Insert                     │
  │  • 50k-row chunks (pandas read_csv)      │
  │  • 5k-row sub-batches (psycopg COPY)     │
  │  • 3-attempt retry per batch             │
  │  • Resume-capable (skips loaded chunks)  │
  └────────────────┬─────────────────────────┘
                   │
                   ▼
  ┌──────────────────────────────────────────┐
  │  STEP 4: Post-Processing                 │
  │  • Relink orphans (dual-key re-scan)     │
  │  • Refresh days_open on leads            │
  │  • Recompute snapshots                   │
  └──────────────────────────────────────────┘
```

### 4.2 Timestamp Parsing

HLES exports timestamps as 14-digit strings (e.g., `20251215143045`). The ETL parses them:

```
  Input:   "20251215143045"
            ────┬───┬─┬──
            YYYY MM DD HHMMSS

  Output:  2025-12-15T14:30:45+00:00 (UTC)
```

Invalid or null values become `pd.NaT` and insert as `NULL`.

### 4.3 Column Mapping (Databricks → Schema)

| Databricks Column | DB Column | Notes |
|---|---|---|
| `id` | `source_id` | Original row ID for dedup |
| `knum` | `knum` | Reservation key (preserved as-is) |
| `reznum` | `rez_num` | Rental agreement number |
| `confirmnum` | `confirm_num` | Confirmation number |
| `loccode` | `loc_code` | Branch code |
| `systemdate` | `system_date` | Parsed from YYYYMMDDHHMMSS → timestamptz |
| `applicationdate` | `application_date` | Parsed from YYYYMMDDHHMMSS → timestamptz |
| `eventtype` | `event_type` | Parsed to smallint |
| `bgn01` | `bgn01` | Sub-type code |
| `statflag` | `stat_flag` | Status flag |
| `sftrans` | `sf_trans` | Transaction reference |
| `msg1` – `msg10` | `msg1` – `msg10` | Event descriptions (preserved) |
| `empcode` | `emp_code` | Employee identifier |
| `emplname` | `emp_lname` | Employee last name |
| `empfname` | `emp_fname` | Employee first name |
| `requesteddays` | `requested_days` | Parsed to int |
| `timezoneoffset` | `timezone_offset` | Parsed to smallint |
| `loaddate` | `load_date` | Parsed to DATE |
| `sourcesystem` | `source_system` | e.g. "HLES" |
| `sourceregion` | `source_region` | e.g. "USA" |

### 4.4 Load Scripts

| Script | Purpose | When to Use |
|---|---|---|
| `scripts/load_translog_csv.py` | Bulk loader with resume capability | Full initial load or reload from Databricks CSV |
| `scripts/prepare_translog_for_import.py` | Pre-process CSV for `psql \COPY` | Alternative fast-path for very large files |
| `scripts/load_rachel_rancho.py` | Targeted load for specific GM/branch | Load a subset (leads + translog) for testing/demo |

---

## 5. Lead Joining Logic

### 5.1 Dual-Key Strategy

The HLES system uses two identifiers that may appear on a translog event:

```
  ┌─────────────────────────────────────────────────────┐
  │              DUAL-KEY LINKAGE                        │
  ├─────────────────────────────────────────────────────┤
  │                                                     │
  │  ATTEMPT 1 (Primary):                               │
  │  translog_events.knum  ──match──▶  leads.knum       │
  │                                                     │
  │      ┌─ Found? ──▶ Set lead_id = leads.id ✓        │
  │      │                                              │
  │      └─ Not found? ──▶ Try Attempt 2                │
  │                                                     │
  │  ATTEMPT 2 (Secondary):                             │
  │  translog_events.rez_num  ──match──▶  leads.        │
  │                                        confirm_num  │
  │                                                     │
  │      ┌─ Found? ──▶ Set lead_id = leads.id ✓        │
  │      │                                              │
  │      └─ Not found? ──▶ lead_id = NULL (orphan) ✗   │
  │                                                     │
  └─────────────────────────────────────────────────────┘
```

### 5.2 Implementation (Load-Time)

During CSV ingestion, two in-memory lookup dictionaries are built from the `leads` table:

```python
# Build lookups from leads table
knum_lookup:       { "K123456": 1001, "K789012": 1002, ... }  # knum → lead_id
confirm_lookup:    { "C-55443": 1003, "C-99887": 1004, ... }  # confirm_num → lead_id

# For each translog row:
lead_id = knum_lookup.get(row.knum) or confirm_lookup.get(row.rez_num) or None
```

### 5.3 Post-Upload Relinking

When new HLES leads are uploaded *after* translog events already exist, orphan events can be retroactively linked:

```sql
-- POST /translog/relink
UPDATE translog_events te
SET lead_id = l.id
FROM leads l
WHERE te.lead_id IS NULL
  AND (
    (te.knum IS NOT NULL AND te.knum = l.knum)
    OR (te.rez_num IS NOT NULL AND te.rez_num = l.confirm_num)
  );
```

### 5.4 What Translog Data Adds to a Lead

Once linked, the translog timeline enriches each lead with:

| Insight | Source Field | Example |
|---|---|---|
| **Contact attempts** | `msg1 = "Loc-Customer Contact"` | When and how the branch reached out |
| **First contact** | `msg1 = "Loc-Initial Customer Contact"` | When the very first outreach happened |
| **Reservation changes** | `msg1 = "Rez-Changed Return Date"` | Customer extended or shortened rental |
| **Cancellations** | `msg1 = "Rez-Cancelled"` | Reservation was cancelled (lost opportunity) |
| **Rental opened** | `msg1 = "R/A-Rent Opened"` | Customer actually picked up vehicle (conversion!) |
| **Vehicle returned** | `msg1 = "R/A-Returned"` | Rental completed |
| **Upsells** | `msg1 = "R/A-Upsell Made"` | Branch upsold the customer |
| **Extension requests** | `msg1 = "Request Extensions-Edit Request"` | Customer asked for more time |
| **Credit failures** | `msg1 = "R/A-Credit Auth Failed"` | Payment issue flagged |
| **MMR status** | `msg10` contains MMR data | Monthly Market Rate pricing applied |
| **Employee who acted** | `emp_fname`, `emp_lname` | Attribution for contact/action |

---

## 6. Filtering Logic — Noise vs. Actionable Insights

### 6.1 The Problem

The raw `hles_translog` table contains **millions** of events, including:
- System-generated EDI messages
- Employee record changes
- Renter insurance/employer updates
- Internal reservation class changes

BMs and GMs don't need this noise. They need to see **what happened to the customer and the reservation**.

### 6.2 Filtering Rules

```
  ┌───────────────────────────────────────────────────────────────┐
  │                    EVENT FILTERING FUNNEL                      │
  ├───────────────────────────────────────────────────────────────┤
  │                                                               │
  │  ALL RAW EVENTS (100%)                                        │
  │  ━━━━━━━━━━━━━━━━━━━━━                                       │
  │       │                                                       │
  │       ▼                                                       │
  │  ┌─ KEEP: Loc-* prefix ──────────────────────────────┐       │
  │  │  All location/customer contact events             │       │
  │  │  Examples:                                        │       │
  │  │    Loc-Customer Contact                           │       │
  │  │    Loc-Initial Customer Contact                   │       │
  │  └───────────────────────────────────────────────────┘       │
  │       │                                                       │
  │       ▼                                                       │
  │  ┌─ KEEP: Rez-* prefix (with exclusions) ────────────┐       │
  │  │  Reservation events EXCEPT:                       │       │
  │  │    ✗ Rez-Change Renter Name                       │       │
  │  │    ✗ Rez-Add/Update Repair Shop                   │       │
  │  │    ✗ Rez-Add/Update Employer                      │       │
  │  │    ✗ Rez-Add/Update Renter's Insurance            │       │
  │  │    ✗ Rez-Changed Res Class                        │       │
  │  └───────────────────────────────────────────────────┘       │
  │       │                                                       │
  │       ▼                                                       │
  │  ┌─ KEEP: R/A-* whitelist (6 events only) ───────────┐       │
  │  │  ✓ R/A-Rent Opened                                │       │
  │  │  ✓ R/A-Post Returned                              │       │
  │  │  ✓ R/A-Returned                                   │       │
  │  │  ✓ R/A-Upsell Made                                │       │
  │  │  ✓ R/A-Credit Auth Failed                         │       │
  │  │  ✓ R/A-Unit Assigned at Open                      │       │
  │  │  ✓ R/A-Changed Return Date                        │       │
  │  │  ✓ R/A-Rate Update                                │       │
  │  └───────────────────────────────────────────────────┘       │
  │       │                                                       │
  │       ▼                                                       │
  │  ┌─ KEEP: Request Extensions-* ──────────────────────┐       │
  │  │  Extension request events                         │       │
  │  └───────────────────────────────────────────────────┘       │
  │       │                                                       │
  │       ▼                                                       │
  │  ┌─ DROP for BM/GM (Admin-only) ─────────────────────┐       │
  │  │  ✗ Edi-* (EDI system transactions)                │       │
  │  │  ✗ Emp-* (Employee management)                    │       │
  │  │  ✗ Sys-* (System-level events)                    │       │
  │  │  ✗ Everything else                                │       │
  │  └───────────────────────────────────────────────────┘       │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
```

### 6.3 Categories for BMs and GMs

Events that pass the filter are categorized into groups that map to conversion-relevant activities:

| Category | Badge Color | What It Tells BM/GM | Conversion Relevance |
|---|---|---|---|
| **Location** (`Loc-*`) | Primary blue | Customer contact attempts & outcomes | **High** — Did we reach the customer? How many attempts? |
| **Reservation** (`Rez-*`) | Warning amber | Reservation lifecycle changes | **High** — Was it cancelled? Date changed? Still active? |
| **Rental Agreement** (`R/A-*`) | Neutral gray | Actual rental operations | **Critical** — Rent opened = conversion confirmed |
| **Extension** (`Request Extensions-*`) | Warning amber | Customer wants more time | **Medium** — Retention opportunity |
| **MMR** (any + msg10 flag) | Info blue | Monthly Market Rate pricing | **Medium** — Rate-sensitive customer context |

### 6.4 Backend Enforcement (SQL)

The filtering is enforced **server-side** via a SQL WHERE clause. When `role=bm` or `role=gm`:

```sql
WHERE (
    (
        (msg1 LIKE 'Loc-%' OR msg1 LIKE 'Rez-%')
        AND msg1 NOT IN (
            'Rez-Change Renter Name',
            'Rez-Add/Update Repair Shop',
            'Rez-Add/Update Employer',
            'Rez-Add/Update Renter''s Insurance',
            'Rez-Changed Res Class'
        )
        AND msg1 NOT LIKE 'Rez-Add/Update Renter%'
    )
    OR msg1 LIKE 'Request Extensions%'
    OR msg1 IN (
        'R/A-Rent Opened', 'R/A-Post Returned', 'R/A-Returned',
        'R/A-Upsell Made', 'R/A-Credit Auth Failed',
        'R/A-Unit Assigned at Open', 'R/A-Changed Return Date',
        'R/A-Rate Update'
    )
)
```

Admin role bypasses this filter entirely.

---

## 7. Humanization Layer

### 7.1 MSG1 → Human-Readable Labels

Raw HLES codes are cryptic. The frontend maps them to plain English:

| Raw MSG1 Code | Humanized Label |
|---|---|
| `Loc-Customer Contact` | "Customer contacted" |
| `Loc-Initial Customer Contact` | "First customer contact" |
| `Rez-Cancelled` | "Reservation cancelled" |
| `Rez-Changed Return Date` | "Return date changed" |
| `Rez-Reactivation` | "Reservation reactivated" |
| `R/A-Rent Opened` | "Rental opened" |
| `R/A-Returned` | "Vehicle returned" |
| `R/A-Post Returned` | "Post-return processed" |
| `R/A-Upsell Made` | "Upsell completed" |
| `R/A-Credit Auth Failed` | "Credit authorization failed" |
| `R/A-Unit Assigned at Open` | "Vehicle assigned at pickup" |
| `R/A-Changed Return Date` | "Return date updated" |
| `R/A-Rate Update` | "Rate updated" |
| `Request Extensions-Edit Request` | "Extension request submitted" |

Unknown codes fall through to their raw `msg1` value (no label = show as-is).

### 7.2 Compact Summary Extraction

Different event types extract different secondary details for the summary line:

```
  ┌────────────────────────────────────────────────────────┐
  │  EVENT TYPE              │  SUMMARY SOURCE             │
  ├──────────────────────────┼─────────────────────────────┤
  │  Contact events          │  msg3 (outcome)             │
  │  Extension requests      │  msg2 (reason)              │
  │  Credit auth failures    │  msg2 (card/reason)         │
  │  Date changes            │  msg2 (new date)            │
  │  Rate updates            │  msg2 (rate/class info)     │
  │  Upsells                 │  msg2 (class info)          │
  │  Cancellations           │  msg2 (reason)              │
  │  All others              │  msg2 (general detail)      │
  └────────────────────────────────────────────────────────┘
```

### 7.3 Employee Attribution

```
  Raw:       emp_fname="EDI"   emp_lname="EDI"
  Humanized: "System (EDI)"

  Raw:       emp_fname="JOHN"  emp_lname="SMITH"
  Humanized: "John Smith"

  Raw:       emp_fname=""      emp_lname=""
  Humanized: (hidden — no attribution shown)
```

### 7.4 Location Formatting

Branch codes like `4940-07 - COVINGTON HLE` are cleaned to just `Covington` via title-case extraction in the timeline display.

### 7.5 Timeline Deduplication

HLES can fire duplicate events within seconds. The frontend deduplicates:

```
  Raw events in 5-min window:
    14:30:01  Loc-Customer Contact
    14:30:03  Loc-Customer Contact
    14:30:05  Loc-Customer Contact

  Displayed as:
    ● Customer contacted               ×3
      2:30 PM · John Smith
```

---

## 8. API Endpoints

### 8.1 Lead Translog (Role-Filtered)

```
GET /leads/{lead_id}/translog?limit=100&offset=0&role=bm
```

Returns paginated, role-filtered translog events for a specific lead.

**Response:**
```json
{
  "total": 42,
  "events": [
    {
      "id": 1,
      "sourceId": 54321,
      "knum": "K123456",
      "locCode": "4940",
      "systemDate": "2025-12-15T14:30:45+00:00",
      "applicationDate": "2025-12-15T14:30:00+00:00",
      "eventType": 1,
      "category": "location",
      "msg1": "Loc-Customer Contact",
      "msg2": "Phone call",
      "msg3": "Connected with customer",
      "empCode": "EMP123",
      "empName": "John Smith",
      "requestedDays": 0
    }
  ]
}
```

### 8.2 Admin Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/translog/stats` | Dashboard stats (total, matched, orphan, unique knums/leads) |
| `GET` | `/translog/orphans` | Paginated orphan groups with search |
| `GET` | `/translog/orphans/{knum}/events` | Individual orphan event details |
| `PUT` | `/translog/orphans/{knum}/map` | Manually map orphan knum → lead_id |
| `DELETE` | `/translog/orphans/{knum}` | Delete all orphan events for a knum |
| `POST` | `/translog/relink` | Bulk re-run dual-key linkage for all orphans |

---

## 9. Frontend Components

### 9.1 TranslogTimeline (BM/GM Lead Detail View)

```
  ┌─────────────────────────────────────────────────────┐
  │  Activity Timeline                                   │
  │  ┌─────────────────────────────────────────────────┐ │
  │  │ Filter: [All] [Contact] [Reservation] [MMR] ... │ │
  │  └─────────────────────────────────────────────────┘ │
  │                                                      │
  │  ● Customer contacted                        ×2     │
  │    Dec 15, 2:30 PM · John Smith                     │
  │    ┌ location ┐                                     │
  │    └──────────┘                                     │
  │    "Connected — agreed to extend rental"            │
  │                                                      │
  │  ● Return date changed                              │
  │    Dec 14, 10:15 AM · Jane Doe                      │
  │    ┌ reservation ┐                                  │
  │    └──────────────┘                                 │
  │    "New date: 01/15/2026"                           │
  │                                                      │
  │  ● Rental opened                                    │
  │    Dec 1, 9:00 AM · System (EDI)                    │
  │    ┌ rental_agreement ┐                             │
  │    └───────────────────┘                            │
  │                                                      │
  └─────────────────────────────────────────────────────┘
```

**Merges three data sources** into one unified timeline:
1. `translog_events` — HLES system events
2. `enrichment_log` — Manual enrichment actions by BM/GM
3. `contact_activities` — Contact log entries

### 9.2 InteractiveTranslogAdmin (Admin Orphan Dashboard)

```
  ┌─────────────────────────────────────────────────────┐
  │  Translog Admin                    [↻ Relink All]   │
  │                                                      │
  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐  │
  │  │ 1.5M    │ │ 1.45M   │ │  50K    │ │  8,000   │  │
  │  │ Total   │ │ Matched │ │ Orphans │ │ Unique   │  │
  │  │ Events  │ │         │ │         │ │ Knums    │  │
  │  └─────────┘ └─────────┘ └─────────┘ └──────────┘  │
  │                                                      │
  │  Search: [________________] 🔍                       │
  │                                                      │
  │  ┌─ K789012 ──── 23 events ── 4940 ──────────────┐  │
  │  │  Dec 1–15 · Loc-Contact, Rez-Cancelled, ...   │  │
  │  │  [▼ Expand]    [Map to Lead]    [Delete]       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  ┌─ K555444 ──── 8 events ── 7109 ───────────────┐  │
  │  │  Nov 20–28 · R/A-Rent Opened, ...             │  │
  │  │  [▶ Expand]    [Map to Lead]    [Delete]       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  ◀ Prev  Page 1 of 12  Next ▶                       │
  └─────────────────────────────────────────────────────┘
```

---

## 10. Orphan Reconciliation

### 10.1 Why Orphans Exist

Translog events may not match any lead when:
- Translog was loaded **before** the corresponding HLES leads upload
- The lead uses a different identifier format
- The lead was deleted or never imported

### 10.2 Reconciliation Strategies

```
  ┌─────────────────────────────────────────────────────────┐
  │  ORPHAN RESOLUTION FLOW                                  │
  ├─────────────────────────────────────────────────────────┤
  │                                                          │
  │  Orphan Event (lead_id = NULL)                           │
  │       │                                                  │
  │       ├──▶ Automatic: POST /translog/relink              │
  │       │    Runs after every HLES upload                  │
  │       │    Re-scans ALL orphans against current leads    │
  │       │    Typical result: "Relinked: 1,250 events"      │
  │       │                                                  │
  │       ├──▶ Manual Map: PUT /translog/orphans/{knum}/map  │
  │       │    Admin identifies the correct lead             │
  │       │    Maps all events for that knum to lead_id      │
  │       │                                                  │
  │       └──▶ Delete: DELETE /translog/orphans/{knum}       │
  │            Admin determines events are irrelevant        │
  │            Only deletes if lead_id IS NULL (safety)      │
  │                                                          │
  └─────────────────────────────────────────────────────────┘
```

---

## 11. File Map

| Layer | File | Responsibility |
|---|---|---|
| **Schema** | `docs/lakebase-migrations/020_translog_events.sql` | Table DDL + indexes |
| **Schema** | `docs/lakebase-migrations/021_add_leads_mmr.sql` | MMR column on leads |
| **ETL** | `etl/clean.py` | Parsing, cleaning, filtering rules, category derivation |
| **Load** | `scripts/load_translog_csv.py` | Bulk CSV → DB with resume capability |
| **Load** | `scripts/prepare_translog_for_import.py` | CSV pre-processing for `psql \COPY` |
| **Load** | `scripts/load_rachel_rancho.py` | Targeted GM/branch subset loader |
| **API** | `routers/translog.py` | Stats, orphan CRUD, relink endpoint |
| **API** | `routers/leads.py` | `/leads/{id}/translog` endpoint, activity report integration |
| **Frontend** | `src/components/TranslogTimeline.jsx` | Timeline display, humanization, dedup, category filters |
| **Frontend** | `src/components/interactive/InteractiveTranslogAdmin.jsx` | Admin orphan dashboard |
| **Data** | `src/data/databricksData.js` (lines 883–949) | API client functions for translog endpoints |
| **Context** | `src/context/DataContext.jsx` | React context provider exposing translog functions |
| **Routing** | `src/router.jsx` | Route registration for admin translog page |
