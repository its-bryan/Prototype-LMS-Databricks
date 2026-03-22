# Local Reset Runbook

Use this when local DB drift or corrupted state causes inconsistent behavior.

Related docs:

- `docs/LOCAL-DEV-SETUP.md` (full local bring-up)
- `docs/DEPLOYMENT-WORKFLOW.md` (promotion gates)

## Full reset

```powershell
./scripts/reset_local.ps1
```

What it does:

1. `dropdb --if-exists lms_leo`
2. `createdb lms_leo`
3. `psql -d lms_leo -f scripts/setup_local_db.sql`
4. Seed from `prodfiles/MainChaddata.xlsx`
5. Restart local backend + frontend

## Reset without reseeding

```powershell
./scripts/reset_local.ps1 -SkipSeed
```

## Common failure signatures

- `Missing .env.local`
  - Fix: copy `.env.local.example` to `.env.local`
- `PGHOST/PGUSER/PGPASSWORD` connection failures
  - Fix: validate `.env.local` values and PostgreSQL service status
- `permission denied` in local
  - Fix: run setup script again and ensure local role has ownership
- Empty dashboards after seed
  - Fix: rerun `python scripts/seed_local_data.py ...` and confirm snapshot tables populated

## Verification checklist

- `python scripts/check_schema_drift.py --target local` returns clean
- `/api/health/runtime` returns `env=local`, `tier=local`
- Login works and BM/GM dashboards load data

If this checklist fails repeatedly, return to `docs/LOCAL-DEV-SETUP.md` and re-validate `.env.local`, Postgres service status, and seed source file.
