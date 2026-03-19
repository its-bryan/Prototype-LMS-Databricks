# Local Dev Testing Guide

This guide explains how to run the app locally for rapid UI iteration and for full-stack testing against Lakebase Postgres.

## Goals

- Iterate quickly on UI/UX without backend dependencies.
- Run full-stack local testing before deployment.
- Keep performance testing realistic by hitting the live API/database path when needed.

## Prerequisites

- Node.js and npm installed.
- Python 3.12+ installed.
- Databricks CLI installed and authenticated.
- Repo cloned locally at `Prototype-LMS-Databricks`.

## Key toggles and config

- `VITE_USE_LIVE_API` (frontend):
  - `true` (default): frontend calls `/api/*` and expects FastAPI backend.
  - `false`: frontend uses embedded mock data for UI-only development.
- `PGHOST` (backend):
  - Required for local FastAPI + Lakebase access.
  - Example: `ep-jolly-cherry-d2k7zib8.database.us-east-1.cloud.databricks.com`
- `DATABRICKS_CONFIG_PROFILE`:
  - Set to your OAuth profile (for example `DanSiaoAuth`).

## Mode A: Mock mode (fast UI iteration)

Use this mode when you want to preview graph/UI changes quickly without backend or auth dependencies.

1. In PowerShell:
   - `$env:VITE_USE_LIVE_API = "false"`
2. Start frontend:
   - `npm run dev`
3. Open the local URL shown by Vite (usually `http://localhost:5173`).

Notes:

- No backend process is required in this mode.
- Data comes from `src/data/mockData.js` via `DataContext`.

## Mode B: Live mode (full-stack local testing)

Use this mode for integration/performance testing against the real API/database path.

1. Authenticate Databricks CLI (if needed):
   - `databricks auth login --host https://hertz-datalab-dataplatform.cloud.databricks.com`
2. Set backend env vars in PowerShell:
   - `$env:PGHOST = "ep-jolly-cherry-d2k7zib8.database.us-east-1.cloud.databricks.com"`
   - `$env:DATABRICKS_CONFIG_PROFILE = "DanSiaoAuth"`
3. Start backend:
   - `uvicorn main:app --host 0.0.0.0 --port 8000`
4. In a second terminal, keep frontend in live mode:
   - `$env:VITE_USE_LIVE_API = "true"`
   - `npm run dev`
5. Open Vite local URL (for example `http://localhost:5173` or `http://localhost:5174`).

How this works:

- `vite.config.js` proxies `/api` requests to `http://localhost:8000`.
- Frontend stays on hot reload while using backend APIs.

## Pre-deploy local validation checklist

Run before pushing and redeploying:

1. `npm run build`
2. `python -m py_compile main.py`
3. `python -m py_compile db.py`
4. `Get-ChildItem routers\*.py | ForEach-Object { python -m py_compile $_.FullName }`
5. Verify the app shell endpoint and one auth endpoint:
   - `GET /` should return `200`
   - `GET /api/auth/me` should return `401` when unauthenticated

## Performance testing workflow

Recommended sequence:

1. Iterate in Mock mode until UI looks correct.
2. Switch to Live mode for realistic latency and DB-backed behavior.
3. Run scripted tests (for example `scripts/frontend_perf_test.py`) against live mode.
4. Capture screenshots and timings in `docs/frontend-test-results/`.

## Troubleshooting

### `FATAL: External authorization failed` from Lakebase

Likely causes:

- Workspace network policy blocks public/local access.
- IP ACL or private link restrictions.
- Missing grants for the authenticated principal.

Actions:

- Confirm `DATABRICKS_CONFIG_PROFILE` is OAuth-based and valid.
- Confirm `PGHOST` is correct.
- If still blocked, use Mock mode for UI work and run live DB tests from allowed environment (Databricks-hosted app/runtime).

### `Port 5173 is in use`

Vite will auto-select another port (for example `5174`). Use the printed local URL.

### `psql` not installed

`psql` is optional for this app runtime. Local backend connectivity uses `psycopg` + Databricks OAuth from `db.py`.

