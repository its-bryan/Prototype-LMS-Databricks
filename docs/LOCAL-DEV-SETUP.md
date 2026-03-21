# Local Development Setup (Local, Staging, Prod Model)

This repo supports a three-environment model:

- Local: `APP_ENV=local`, `APP_TIER=local`, local PostgreSQL
- Staging: `APP_ENV=databricks`, `APP_TIER=staging`, Lakebase DB `lms_staging`
- Prod: `APP_ENV=databricks`, `APP_TIER=prod`, Lakebase DB `databricks_postgres`

## 1) Prerequisites

- Python 3.12 (`.python-version`)
- Node 22.14 (`.nvmrc`)
- PostgreSQL 17 client + server (`psql`, `createdb`, `dropdb`)
- Git

Verify:

```powershell
python --version
node --version
npm --version
git --version
psql --version
```

## 2) Clone and install dependencies

```powershell
git clone <repo-url>
cd Prototype-LMS-Databricks
npm install
pip install -r requirements.txt
```

## 3) Create local env file

```powershell
copy .env.local.example .env.local
```

Edit `.env.local` values if needed (DB credentials, paths).

## 4) Create and initialize local database

```powershell
createdb lms_leo
psql -d lms_leo -f scripts/setup_local_db.sql
```

This creates schema + config + auth seed + `schema_migrations`.

## 5) Seed realistic data (optional but recommended)

```powershell
python scripts/seed_local_data.py prodfiles/MainChaddata.xlsx --target local
```

Optional branch-aligned BM test user:

```powershell
python scripts/seed_local_data.py prodfiles/MainChaddata.xlsx --target local --create-aligned-bm-user
```

## 6) Start local stack

```powershell
./scripts/start_local.ps1
```

This starts:

- FastAPI backend on `http://localhost:8000`
- Vite frontend on `http://localhost:5173`

## 7) Validate runtime and smoke

```powershell
python scripts/smoke_test.py --target local --base-url http://localhost:8000 --email admin.leo@hertz.com --password <password>
```

## Notes

- `/api/health/runtime` is open in local mode and auth-protected in staging/prod.
- Collision guard: app hard-fails if staging is configured with `PGDATABASE=databricks_postgres`.
- Do not set `PGDATABASE` in prod `app.yaml`; prod defaults to `databricks_postgres` in `db.py`.
