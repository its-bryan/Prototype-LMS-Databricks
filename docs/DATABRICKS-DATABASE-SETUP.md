# Databricks Database Setup — LMS Prototype

> **Purpose**: Set up Lakebase Postgres tables in Databricks that mirror the Supabase schema, set up a FastAPI backend for the React app, and enable file uploads with data cleaning.

**Date started**: 2026-03-10
**Database**: Lakebase Postgres (Databricks)
**Dev schema**: `lab_lms_dev`
**Prod schema**: `lab_lms_prod`

---

## Part 1: Connect to Lakebase Postgres

### Connection details

| Field | Value |
|-------|-------|
| Host | `ep-jolly-cherry-d2k7zib8.database.us-east-1.cloud.databricks.com` |
| Database | `databricks_postgres` |
| User | `nh136948@hertz.net` |
| Auth | OAuth token (used as password) |
| SSL | Required (`sslmode=require`) |

### Connection string format

```
postgresql://nh136948%40hertz.net:<OAUTH_TOKEN>@ep-jolly-cherry-d2k7zib8.database.us-east-1.cloud.databricks.com/databricks_postgres?sslmode=require
```

> **Note**: The `@` in the username is URL-encoded as `%40`. The OAuth token goes in the password position.

### How to connect

**Option A — psql (terminal)**:
```bash
export DATABASE_URL="postgresql://nh136948%40hertz.net:<OAUTH_TOKEN>@ep-jolly-cherry-d2k7zib8.database.us-east-1.cloud.databricks.com/databricks_postgres?sslmode=require"
psql "$DATABASE_URL"
```

**Option B — GUI client** (DBeaver, pgAdmin, DataGrip):
- Host: `ep-jolly-cherry-d2k7zib8.database.us-east-1.cloud.databricks.com`
- Port: `5432` (default)
- Database: `databricks_postgres`
- Username: `nh136948@hertz.net`
- Password: paste the OAuth token
- SSL: require

**Option C — Python (for testing)**:
```python
import psycopg2
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()
cur.execute("SELECT 1")
print(cur.fetchone())  # should print (1,)
conn.close()
```

> **Prod**: For the production environment, connect to the `lab_lms_prod` schema instead of `lab_lms_dev`.

---

## Part 2: Create Tables

Run the combined migration scripts from the `lakebase-migrations/` directory:

- `docs/Prototype-LeadMgmtsys/lakebase-migrations/001_full_schema.sql` — creates all 11 tables
- `docs/Prototype-LeadMgmtsys/lakebase-migrations/002_seed_config.sql` — seeds config data

These scripts use standard PostgreSQL DDL (JSONB, CHECK constraints, foreign keys, indexes) — the same dialect as the original Supabase schema.

> **Dev vs. prod**: Run the scripts against the `lab_lms_dev` schema for development. For production, set the search path to `lab_lms_prod` before running.

---

## Part 3: Verify Tables

After running the migration, confirm everything was created:

```sql
\dt
-- or
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

You should see 11 tables:
- `org_mapping`, `leads`, `tasks`, `user_profiles`, `lead_activities`
- `branch_managers`, `weekly_trends`, `upload_summary`
- `leaderboard_data`, `cancellation_reason_categories`, `next_actions`

To inspect any table's structure:

```sql
\d leads
```

---

## Part 4: Seed Config Data

Run the seed script:

```bash
psql $DATABASE_URL -f lakebase-migrations/002_seed_config.sql
```

This inserts cancellation reason categories, next actions, sample org mapping, and demo user profiles.

---

## Part 5: FastAPI Backend Architecture

The React app currently calls Supabase directly. In Databricks, we replace that with a FastAPI backend that:

1. **Serves the React static files** (`dist/`)
2. **Exposes REST API endpoints** (`/api/leads`, `/api/upload`, etc.)
3. **Queries Lakebase Postgres** using `psycopg2`

### 5.1 — Project Structure (Databricks App)

```
hertz-lms/
├── app.yaml                  # Databricks Apps config
├── requirements.txt          # Python dependencies
├── main.py                   # FastAPI server
├── db.py                     # Lakebase Postgres connection helper
├── routers/
│   ├── leads.py              # /api/leads endpoints
│   ├── tasks.py              # /api/tasks endpoints
│   ├── config.py             # /api/config (org mapping, reasons, actions)
│   └── upload.py             # /api/upload (file upload + ETL)
├── etl/
│   ├── clean.py              # Data cleaning functions
│   └── ingest.py             # HLES/TRANSLOG file parsing
├── dist/                     # React build output (vite build)
│   ├── index.html
│   └── assets/
└── package.json              # For npm build step (React)
```

### 5.2 — `app.yaml` (updated for FastAPI)

```yaml
command: ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000']
```

### 5.3 — `requirements.txt`

```
fastapi>=0.104.0
uvicorn>=0.24.0
psycopg2-binary>=2.9.0
pandas>=2.0.0
openpyxl>=3.1.0
python-multipart>=0.0.6
```

### 5.4 — `db.py` (Connection helper)

```python
import os
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ["DATABASE_URL"]

def get_connection():
    return psycopg2.connect(DATABASE_URL)

def query(sql: str, params: tuple = None) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()

def execute(sql: str, params: tuple = None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
```

### 5.5 — `main.py` (FastAPI server)

```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import leads, tasks, config, upload

app = FastAPI(title="Hertz LMS API")

# API routes
app.include_router(leads.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(upload.router, prefix="/api")

# Serve React static files
app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

# SPA fallback — serve index.html for all non-API routes
@app.get("/{path:path}")
async def spa_fallback(path: str):
    return FileResponse("dist/index.html")
```

### 5.6 — Example Router: `routers/leads.py`

```python
from fastapi import APIRouter
import json
from db import query, execute

router = APIRouter()

@router.get("/leads")
async def get_leads():
    # JSONB columns (translog, enrichment, enrichment_log) are returned as
    # Python dicts/lists automatically by psycopg2 — no json.loads() needed.
    rows = query("SELECT * FROM leads WHERE archived = false ORDER BY created_at DESC")
    return rows

@router.get("/leads/{lead_id}")
async def get_lead(lead_id: int):
    rows = query("SELECT * FROM leads WHERE id = %s", (lead_id,))
    if not rows:
        return {"error": "Lead not found"}, 404
    return rows[0]

@router.put("/leads/{lead_id}/enrichment")
async def update_enrichment(lead_id: int, body: dict):
    execute(
        """UPDATE leads SET
            enrichment = %s,
            enrichment_log = %s,
            enrichment_complete = %s,
            status = COALESCE(%s, status),
            updated_at = current_timestamp()
        WHERE id = %s""",
        (
            json.dumps(body.get("enrichment")),
            json.dumps(body.get("enrichment_log", [])),
            body.get("enrichment_complete", False),
            body.get("status"),
            lead_id,
        )
    )
    return {"ok": True}
```

### 5.7 — Example Router: `routers/upload.py`

```python
from fastapi import APIRouter, UploadFile, File
import pandas as pd
import json
import io
from db import execute, query
from etl.clean import clean_hles_data, clean_translog_data

router = APIRouter()

@router.post("/upload/hles")
async def upload_hles(file: UploadFile = File(...)):
    """Upload HLES Excel file → clean → insert/update leads table."""
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

    # Clean the data
    df_clean = clean_hles_data(df)

    stats = {"rowsParsed": len(df), "newLeads": 0, "updated": 0, "failed": 0}

    for _, row in df_clean.iterrows():
        existing = query(
            "SELECT id FROM leads WHERE reservation_id = %s",
            (row["reservation_id"],)
        )
        if existing:
            execute(
                """UPDATE leads SET
                    customer = %s, status = %s, branch = %s, bm_name = %s,
                    insurance_company = %s, hles_reason = %s,
                    init_dt_final = %s, updated_at = current_timestamp()
                WHERE reservation_id = %s""",
                (
                    row["customer"], row["status"], row["branch"], row["bm_name"],
                    row["insurance_company"], row["hles_reason"],
                    row["init_dt_final"], row["reservation_id"],
                )
            )
            stats["updated"] += 1
        else:
            execute(
                """INSERT INTO leads
                    (customer, reservation_id, status, branch, bm_name,
                     insurance_company, hles_reason, init_dt_final)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    row["customer"], row["reservation_id"], row["status"],
                    row["branch"], row["bm_name"], row["insurance_company"],
                    row["hles_reason"], row["init_dt_final"],
                )
            )
            stats["newLeads"] += 1

    # Record upload summary
    execute(
        "INSERT INTO upload_summary (hles, translog, data_as_of_date) VALUES (%s, %s, %s)",
        (json.dumps(stats), '{}', str(pd.Timestamp.now().date()))
    )

    return stats

@router.post("/upload/translog")
async def upload_translog(file: UploadFile = File(...)):
    """Upload TRANSLOG Excel file → match events to leads."""
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")

    df_clean = clean_translog_data(df)

    stats = {"eventsParsed": len(df), "matched": 0, "orphan": 0}

    for _, row in df_clean.iterrows():
        existing = query(
            "SELECT id, translog FROM leads WHERE reservation_id = %s",
            (row["reservation_id"],)
        )
        if existing:
            lead = existing[0]
            # translog is JSONB — psycopg2 returns it as a Python list directly
            current_log = lead["translog"] or []
            current_log.append({
                "time": str(row.get("event_time", "")),
                "event": row.get("event_type", ""),
                "outcome": row.get("outcome", "")
            })
            execute(
                """UPDATE leads SET
                    translog = %s,
                    last_activity = current_timestamp(),
                    updated_at = current_timestamp()
                WHERE id = %s""",
                (json.dumps(current_log), lead["id"])
            )
            stats["matched"] += 1
        else:
            stats["orphan"] += 1

    return stats
```

### 5.8 — `etl/clean.py` (Data cleaning)

```python
"""Data cleaning functions for HLES and TRANSLOG uploads."""
import pandas as pd
import re


def clean_hles_data(df: pd.DataFrame) -> pd.DataFrame:
    """Clean HLES Excel data for insertion into leads table.

    Handles:
    - Column name normalization (strip whitespace, newlines, lowercase)
    - Duplicate reservation IDs (keep latest)
    - Missing required fields
    - Date parsing for init_dt_final
    - Status mapping
    """
    # Normalize column names: strip whitespace/newlines, lowercase
    df.columns = [re.sub(r'\s+', '_', col.strip().lower()) for col in df.columns]

    # Common column mappings from HLES/CRESER format
    col_map = {
        'res_id': 'reservation_id',
        'cust_name': 'customer',
        'cust_nm': 'customer',
        'br_name': 'branch',
        'branch_name': 'branch',
        'bm': 'bm_name',
        'branch_manager': 'bm_name',
        'ins_co': 'insurance_company',
        'insurance': 'insurance_company',
        'cancel_reason': 'hles_reason',
        'reason': 'hles_reason',
        'rent_ind': 'rent_ind',
        'init_dt_final': 'init_dt_final',
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    # Map RENT_IND to status
    if 'rent_ind' in df.columns:
        df['status'] = df['rent_ind'].map({1: 'Rented', 0: 'Cancelled'}).fillna('Unused')

    # Parse dates
    if 'init_dt_final' in df.columns:
        df['init_dt_final'] = pd.to_datetime(df['init_dt_final'], errors='coerce').dt.date

    # Drop duplicates — keep last occurrence
    if 'reservation_id' in df.columns:
        df = df.drop_duplicates(subset='reservation_id', keep='last')

    # Drop rows missing required fields
    required = ['reservation_id', 'customer', 'branch']
    for col in required:
        if col in df.columns:
            df = df.dropna(subset=[col])

    # Fill optional string fields
    for col in ['bm_name', 'insurance_company', 'hles_reason']:
        if col in df.columns:
            df[col] = df[col].fillna('')
        else:
            df[col] = ''

    if 'status' not in df.columns:
        df['status'] = 'Unused'

    return df


def clean_translog_data(df: pd.DataFrame) -> pd.DataFrame:
    """Clean TRANSLOG Excel data for matching to leads.

    Handles:
    - Column name normalization
    - Timestamp parsing
    - Deduplication
    """
    # Normalize column names
    df.columns = [re.sub(r'\s+', '_', col.strip().lower()) for col in df.columns]

    col_map = {
        'res_id': 'reservation_id',
        'event_dt': 'event_time',
        'event_date': 'event_time',
        'event': 'event_type',
        'action': 'event_type',
        'result': 'outcome',
        'disposition': 'outcome',
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    # Parse timestamps
    if 'event_time' in df.columns:
        df['event_time'] = pd.to_datetime(df['event_time'], errors='coerce')

    # Drop rows without reservation_id
    if 'reservation_id' in df.columns:
        df = df.dropna(subset=['reservation_id'])

    return df
```

---

## Part 6: Frontend Changes (React → API calls)

The React app needs a new data service file that calls `/api/*` instead of Supabase. This replaces `supabaseData.js`.

### 6.1 — New file: `src/data/databricksData.js`

```javascript
/** Data service for Databricks backend — replaces supabaseData.js */

const API = '/api';

async function fetchJSON(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postJSON(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function putJSON(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- Queries ---
export const fetchLeads = () => fetchJSON('/leads');
export const fetchOrgMapping = () => fetchJSON('/config/org-mapping');
export const fetchBranchManagers = () => fetchJSON('/config/branch-managers');
export const fetchWeeklyTrends = () => fetchJSON('/config/weekly-trends');
export const fetchUploadSummary = () => fetchJSON('/config/upload-summary');
export const fetchLeaderboardData = () => fetchJSON('/config/leaderboard');
export const fetchCancellationReasonCategories = () => fetchJSON('/config/cancel-reasons');
export const fetchNextActions = () => fetchJSON('/config/next-actions');
export const fetchLeadActivities = (leadId) => fetchJSON(`/leads/${leadId}/activities`);
export const fetchTasksForLead = (leadId) => fetchJSON(`/tasks?lead_id=${leadId}`);
export const fetchTasksForBranch = (branch) => fetchJSON(`/tasks?branch=${encodeURIComponent(branch)}`);
export const fetchTaskById = (taskId) => fetchJSON(`/tasks/${taskId}`);

// --- Mutations ---
export const updateLeadEnrichment = (leadId, enrichment, logEntry, status) =>
  putJSON(`/leads/${leadId}/enrichment`, { enrichment, enrichment_log_entry: logEntry, status });

export const updateLeadDirective = (leadId, gmDirective) =>
  putJSON(`/leads/${leadId}/directive`, { gm_directive: gmDirective });

export const updateLeadContact = (leadId, contact, logEntry) =>
  putJSON(`/leads/${leadId}/contact`, { ...contact, enrichment_log_entry: logEntry });

export const updateTaskStatus = (taskId, status) =>
  putJSON(`/tasks/${taskId}/status`, { status });

export const appendTaskNote = (taskId, noteText, author) =>
  postJSON(`/tasks/${taskId}/notes`, { note: noteText, author });

export const archiveLead = (leadId) =>
  putJSON(`/leads/${leadId}/archive`, {});

// --- File Upload ---
export async function uploadHLES(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API}/upload/hles`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export async function uploadTranslog(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API}/upload/translog`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}
```

### 6.2 — Update `DataContext.jsx`

In `DataContext.jsx`, add a third mode alongside mock and Supabase:

```javascript
// At the top of DataContext.jsx:
const useSupabase = import.meta.env.VITE_USE_SUPABASE === 'true';
const useDatabricks = import.meta.env.VITE_USE_DATABRICKS === 'true';

// Then import the right data service:
const dataService = useDatabricks
  ? await import('./data/databricksData.js')  // Databricks API
  : useSupabase
    ? await import('./data/supabaseData.js')   // Supabase direct
    : null;                                     // Mock data mode
```

Or simpler: just set `VITE_USE_DATABRICKS=true` in the build and have `DataContext` import from `databricksData.js` instead of `supabaseData.js`.

---

## Part 7: Deployment Steps

### 7.1 — Build the React app

```bash
cd prototype-lms
VITE_USE_DATABRICKS=true npm run build
```

### 7.2 — Set up the Python backend

Copy the FastAPI files (`main.py`, `db.py`, `routers/`, `etl/`, `requirements.txt`) alongside the React `dist/` folder.

### 7.3 — Update `app.yaml`

```yaml
command: ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000']
```

### 7.4 — Deploy to Databricks

Push to GitHub or upload to workspace, then deploy the app.

### 7.5 — Set environment variables

In the Databricks App config, set:
- `DATABASE_URL` — Lakebase Postgres connection string:
  ```
  postgresql://nh136948%40hertz.net:<OAUTH_TOKEN>@ep-jolly-cherry-d2k7zib8.database.us-east-1.cloud.databricks.com/databricks_postgres?sslmode=require
  ```
  For secrets, use a Databricks secret scope:
  ```yaml
  env:
    - name: DATABASE_URL
      valueFrom: "your-secret-scope/lakebase-url"
  ```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `GENERATED ALWAYS AS IDENTITY` error | Older Postgres version | Use `SERIAL` instead |
| Connection refused | Wrong host/port or firewall | Verify Lakebase Postgres endpoint and network access |
| `relation does not exist` | Wrong schema or not created | Run `001_full_schema.sql` first |
| Permission denied | Insufficient grants | Request SELECT, INSERT, UPDATE, DELETE on the schema |
| JSONB query errors | Wrong JSON syntax | Use `->` for object access, `->>` for text extraction |
| Upload fails with memory error | Large Excel file | Process in chunks: `pd.read_excel(..., chunksize=1000)` |

---

## Change Log

| Date | Change | Details |
|------|--------|---------|
| 2026-03-10 | Created setup guide | Initial version with all 11 tables, FastAPI backend, file upload |
| 2026-03-10 | Target: `datalabs.datalabs_lab_leo_dev1` | User confirmed Unity Catalog structure |
| 2026-03-16 | Updated schema names | Dev: `datalabs.lab_lms_dev`, Prod: `datalabs.lab_lms_prod` (schemas created by client admin) |
| 2026-03-16 | Switched to Lakebase Postgres | Replaced Delta tables approach with Lakebase Postgres for low-latency CRUD. Reused Supabase migration SQL. |

---

## Notes

- **Why Lakebase Postgres over Delta tables**: Delta tables via SQL Warehouse have high latency for CRUD operations (cold start, compute overhead). Lakebase Postgres provides low-latency transactional access suitable for web apps.
- **Schema compatibility**: The Supabase migration SQL works nearly as-is since both are PostgreSQL. The main removal was Supabase-specific RLS policies and auth.users references.
- **JSONB is native**: Unlike Delta (which stores JSON as STRING), Lakebase Postgres supports JSONB natively — no serialization/deserialization needed in application code.
