# HLES and TRANSLOG Volume Landing: Behavior and Testing

This doc captures how the **Volume paths** for HLES and TRANSLOG uploads are handled so they stay consistent and testable.

---

## Behavior summary

**HLES**: When a user uploads an HLES Excel file via Admin → File upload (or `POST /api/upload/hles`):

1. **Land in Volume (optional)**  
   The raw file is written to the Unity Catalog Volume **`datalabs.lab_lms_prod.hles_landing_prod`** at a path like:
   `/Volumes/datalabs/lab_lms_prod/hles_landing_prod/<YYYYMMDD_HHMMSS>_<filename>.xlsx`

2. **ETL always runs**  
   Regardless of whether the Volume write succeeds or is skipped, the same bytes are run through `clean_hles_data()` and inserted/updated in **Lakebase Postgres**. Upload never fails *only* because of Volume.

3. **When the Volume write is skipped**  
   - **Path not configured**: `HLES_LANDING_VOLUME_PATH` is empty (e.g. set to `""` for local dev).  
   - **Path not available**: The path is set but not usable (e.g. not running on Databricks, no FUSE, volume missing, or permission denied). In that case the write is attempted, fails, we catch the exception, return `None`, and **do not** re-raise — ETL still runs.

So: **Volume landing is best-effort; Postgres load is not.**

**TRANSLOG**: The same pattern applies. Uploaded TRANSLOG Excel files are written to `datalabs.lab_lms_prod.translog_landing_prod` when `TRANSLOG_LANDING_VOLUME_PATH` is set and writable; otherwise the write is skipped and event matching to leads still runs. Response may include `landedPath` when the file was written to the Volume.

---

## Environment

| Scenario | `HLES_LANDING_VOLUME_PATH` | Result |
|----------|----------------------------|--------|
| **Databricks (Apps with FUSE)** | Default or set to `/Volumes/datalabs/lab_lms_prod/hles_landing_prod` | File written to Volume; response includes `landedPath`. |
| **Local / test** | Set to `""` (empty) | No write attempted; no exception; ETL runs; no `landedPath` in response. |
| **Path set but invalid** (e.g. local machine, no Volume) | Unchanged default | Write attempted, fails, caught; returns `None`; ETL runs; no `landedPath`. |

The same logic applies to **TRANSLOG** and `TRANSLOG_LANDING_VOLUME_PATH`; only the default path and endpoint differ.

**Defaults** (if env is not set):  
- HLES: `HLES_LANDING_VOLUME_PATH` → `/Volumes/datalabs/lab_lms_prod/hles_landing_prod`  
- TRANSLOG: `TRANSLOG_LANDING_VOLUME_PATH` → `/Volumes/datalabs/lab_lms_prod/translog_landing_prod`

**Override**: Set the env vars (e.g. in Databricks App env or `.env`). Use an empty value to disable that Volume write (e.g. for local testing).

---

## Technical note (POSIX path)

The Volume path is a **POSIX-style path**. On Databricks (e.g. Apps with FUSE), `open(path, "wb")` works for that path. On environments where that path is not available (e.g. Windows or a host that doesn’t mount the Volume), the write is skipped (exception caught, `None` returned) and ETL still runs.

---

## How to verify

1. **Run the test script** (see below):  
   `python scripts/test_volume_landing.py`  
   This checks: env empty → no write; env = temp dir → write succeeds; env = invalid path → no exception, returns None.

2. **Manual**  
   - With `HLES_LANDING_VOLUME_PATH=""`: upload an HLES file → success, no `landedPath` in response.  
   - On Databricks with default path: upload → success, `landedPath` in response and file under the Volume.

---

## Where TRANSLOG lives in Postgres

There is **no separate translog table**. TRANSLOG events are stored on the **`leads`** table:

- **`leads.translog`** (JSONB, default `[]`) — array of event objects: `{ "time": "...", "event": "...", "outcome": "..." }`. Each upload appends matched events to the lead’s `translog` and updates `last_activity`.

So Postgres is already set up for translog: the column exists in `leads` (see `001_full_schema.sql`). No extra migration is required for TRANSLOG data.

---

## Test script

See **`scripts/test_volume_landing.py`**. It sets the env, reloads the upload module so the new env is used, and asserts the three behaviors above. Run from repo root:  
`python scripts/test_volume_landing.py`
