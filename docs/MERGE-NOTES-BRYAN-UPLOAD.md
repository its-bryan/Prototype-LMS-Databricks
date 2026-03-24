# Merge Note: Upload Mechanism Strategy

Date: 2026-03-24

This note documents the intentional divergence discussed during Bryan PR #5 merge work.

## Decision

- Staging/prod path in this repo keeps the synchronous HLES ingest mechanism in `routers/upload.py`:
  - chunked `SELECT` for existing `confirm_num`
  - batch `INSERT` for new rows
  - batch `UPDATE ... FROM (VALUES ...)` for existing rows
- We still keep Bryan's ingestion-status polling fields (`newLeads`, `updated`, `failed`, `rowsParsed`) and ET timezone timestamps.

## Why

- Bryan's local workflow used a COPY-based approach because Neon local performance was slow for his environment.
- Databricks Lakebase performance characteristics are different, and the current synchronous insert/update mechanism is acceptable for staging/prod needs.
- Keeping one canonical production/staging mechanism avoids accidental drift in operational behavior.

## Guidance for future PRs

- If local-only performance work requires a different ingest approach (for example COPY), isolate it behind one of:
  - a local-only feature flag (for example `APP_ENV=local` gated branch), or
  - a separate experimental script outside the production router path.
- Do not replace staging/prod upload logic in `routers/upload.py` without explicit approval.
- If proposing COPY migration again, include:
  - benchmark data for Lakebase staging,
  - rollback plan,
  - ingestion-status compatibility check,
  - snapshot/observatory post-upload behavior parity.

## Review checklist for upload-related PRs

- `upload_hles` returns `uploadId` and keeps polling contract fields.
- `/upload/ingestion-status/{id}` includes `state`, `error`, `newLeads`, `updated`, `failed`, `rowsParsed`.
- ET timestamps are consistent for ingestion status and landed filenames.
- Snapshot/background jobs still run after lead upsert.
