# Local Development Setup (Canonical Guide)

This runbook brings up a full local LMS stack on a new Windows machine so you can build features locally and promote safely to Staging and Prod.

This repo supports a three-environment model:

- Local: `APP_ENV=local`, `APP_TIER=local`, local PostgreSQL
- Staging: `APP_ENV=databricks`, `APP_TIER=staging`, Lakebase DB `lms_staging`
- Prod: `APP_ENV=databricks`, `APP_TIER=prod`, Lakebase DB `databricks_postgres`

## Objective

By the end of this guide, you should have:

- Frontend running locally (`http://localhost:5173`)
- Backend running locally (`http://localhost:8000`)
- Local PostgreSQL database initialized with LMS schema
- Seeded data loaded (prod-equivalent HLE file)
- Local smoke test passing

## 1) Prerequisites (new machine)

Install:

- Python `3.12`
- Node `22.x` (matches `.nvmrc`)
- Git
- PostgreSQL `17` (or `16` if required)

Recommended Windows installs:

- Python: `winget install Python.Python.3.12`
- Node (via fnm): `winget install Schniz.fnm`
- Git: `winget install Git.Git`
- PostgreSQL: `winget install PostgreSQL.PostgreSQL.17`

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
git clone https://github.com/popcornAlesto33/Prototype-LMS-Databricks.git
cd "Prototype-LMS-Databricks"
python -m pip install -r requirements.txt
npm install
```

## 3) Create local env file

```powershell
Copy-Item ".env.local.example" ".env.local"
```

Review and confirm these minimum values in `.env.local`:

- `APP_ENV=local`
- `APP_TIER=local`
- `PGHOST=localhost`
- `PGDATABASE=lms_leo`
- `PGUSER=postgres`
- `PGPASSWORD=<your local postgres password>`
- `PGPORT=5432`
- `LEO_JWT_SECRET=<local-only secret>`
- `HLES_LANDING_VOLUME_PATH=./local-uploads/hles`
- `TRANSLOG_LANDING_VOLUME_PATH=./local-uploads/translog`

## 4) Create and initialize local database

```powershell
dropdb lms_leo
createdb lms_leo
psql -d lms_leo -f scripts/setup_local_db.sql
```

If `dropdb` fails because DB does not exist, continue with `createdb`.

This creates schema + config + auth seed + `schema_migrations`.

## 5) Seed realistic data

```powershell
python scripts/seed_local_data.py "prodfiles/MainChaddata.xlsx" --target local
```

Optional branch-aligned BM test user:

```powershell
python scripts/seed_local_data.py "prodfiles/MainChaddata.xlsx" --target local --create-aligned-bm-user
```

If your org mapping must be aligned from approved export, run mapping import first, then rerun seed.

## 6) Start local stack

```powershell
./scripts/start_local.ps1
```

This should:

- Load `.env.local`
- Verify Postgres connectivity
- Start FastAPI + Vite

## 7) Validate local runtime

In browser:

- Open `http://localhost:5173`
- Log in with seeded local test users
- Confirm dashboards, leads, tasks load

Runtime API:

- Open `http://localhost:8000/api/health/runtime`
- Expected: `env=local`, `tier=local`, and local DB host/db values

## 8) Run local smoke test

```powershell
python scripts/smoke_test.py --target local
```

Or with explicit credentials/base URL:

```powershell
python scripts/smoke_test.py --target local --base-url http://localhost:8000 --email admin.leo@hertz.com --password <password>
```

## 9) Local acceptance gates

- `APP_ENV=local` and `APP_TIER=local`
- App uses local DB only (never Databricks host)
- Schema/index set present from `scripts/setup_local_db.sql`
- Seeded data visible in UI
- BM/GM mapping behaves as expected
- Local smoke test passes

## 10) Promotion workflow after local dev

1. Build and test locally
2. Push to `main`
3. Deploy to Staging
4. Validate Staging and record pass artifact (`staging_passed_<sha>.json`)
5. Promote same commit SHA to Prod

## 11) Troubleshooting

- `psql` not found
  - Add PostgreSQL `bin` to PATH and restart terminal

- Cannot connect to local DB
  - Check `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` in `.env.local`
  - Ensure PostgreSQL service is running

- Local app tries to hit remote Databricks DB
  - Confirm `.env.local` has `APP_ENV=local` and `PGHOST=localhost`
  - Runtime guard should fail startup if misconfigured

- BM/GM sees empty leads
  - Re-run seed with the right HLE file
  - Verify org mapping parity and branch alignment for auth users

- Need clean reset
  - Run `./scripts/reset_local.ps1`

## Notes

- `/api/health/runtime` is open in local mode and auth-protected in staging/prod.
- Collision guard: app hard-fails if staging is configured with `PGDATABASE=databricks_postgres`.
- Do not set `PGDATABASE` in prod `app.yaml`; prod defaults to `databricks_postgres` in `db.py`.
