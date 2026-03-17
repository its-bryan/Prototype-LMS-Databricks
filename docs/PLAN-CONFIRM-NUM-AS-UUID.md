# Plan: Confirmation Number as UUID, Customer = RENTER_LAST

**Date**: 2026-03-17  
**Context**: Business clarified that CONFIRM_NUM (Confirmation Number) is the unique identifier; RES_ID is always 1 (reservation = true) and not an ID; customer = RENTER_LAST (Customer Last Name); ADJ FNAME/LNAME = adjuster names.

---

## 1. Schema (Lakebase migration)

- **confirm_num**: Add `UNIQUE` constraint so we can use it as the business key for lookups. (Leave nullable for existing rows that may not have it.)
- **reservation_id**: Make nullable (`DROP NOT NULL`) so we are not forced to store RES_ID. New rows will set `reservation_id = confirm_num` for display/compatibility so the UI keeps showing “Reservation #” = confirmation number.
- **Optional**: Add `adjuster_fname`, `adjuster_lname` (or single `adjuster_name`) if we want to store adjuster names; not required for this change.

**File**: New migration `005_confirm_num_unique_reservation_id_nullable.sql` (or append to existing migration instructions).

---

## 2. ETL (`etl/clean.py`)

- **Customer**: Set from **RENTER_LAST** only (map `renter_last` → `customer`). Remove customer from ADJ FNAME + ADJ LNAME.
- **Unique key / dedup**: Use **confirm_num** instead of res_id:
  - Require and validate `confirm_num` (drop rows with missing/invalid confirm_num).
  - Drop duplicates by `confirm_num` (keep last).
- **res_id**: Stop mapping `res_id` → `reservation_id`. Optionally still output `reservation_id = confirm_num` in the cleaned DataFrame so the upload router can write one “display” ID column (for UI).
- **RES_ID**: Do not use as identifier; can be ignored or stored as an optional flag if needed later.
- **Adjuster**: Optionally output `adj_fname` / `adj_lname` for new columns if we add them to the schema later.

---

## 3. Upload router (`routers/upload.py`)

- **Match existing lead**: `SELECT id FROM leads WHERE confirm_num = %s` (instead of `reservation_id`).
- **UPDATE**: `WHERE confirm_num = %s`; set `reservation_id = %s` to the same confirm_num value for display.
- **INSERT**: Include `confirm_num`; set `reservation_id = confirm_num` so both columns are populated and UI “Reservation #” = confirmation number.
- **TRANSLOG**: Match leads by `confirm_num` if the TRANSLOG ETL provides it; otherwise keep matching by `reservation_id` for backward compatibility (TRANSLOG may use a different column — confirm in TRANSLOG file format).

---

## 4. Frontend

- **databricksData.js** `leadFromRow`: Already has `confirmNum: r.confirm_num ?? r.reservation_id` and `reservationId: r.reservation_id`. If backend sets `reservation_id = confirm_num`, no change needed; “Reservation #” will show confirmation number. If we ever stop sending `reservation_id`, set `reservationId: r.confirm_num ?? r.reservation_id` so the display ID is always the confirmation number.
- No other frontend changes required for this plan; existing `reservationId` / `confirmNum` usage continues to work.

---

## 5. TRANSLOG

- **Current**: Matches by `reservation_id`. TRANSLOG ETL maps `res_id` → `reservation_id`.
- **Change**: If TRANSLOG files contain confirmation number, add mapping and match on `confirm_num`. If they only have RES_ID or another key, keep matching on `reservation_id` (which we now backfill with confirm_num for HLES-sourced leads). Document in HANDOFF which key TRANSLOG uses.

---

## 6. Order of implementation

1. **Migration**: Run 005 (confirm_num UNIQUE, reservation_id nullable).
2. **ETL**: clean.py — customer from renter_last; dedup/required on confirm_num; stop using res_id as ID; output reservation_id = confirm_num for display.
3. **Upload router**: Match and write by confirm_num; set reservation_id = confirm_num.
4. **TRANSLOG**: Prefer confirm_num if present; else reservation_id.
5. **Frontend**: Only adjust leadFromRow if we stop sending reservation_id (optional).
6. **Docs**: Update HANDOFF-ETL-PHASE2.md with correct semantics (customer = RENTER_LAST, UUID = CONFIRM_NUM, RES_ID = flag).

---

## 7. RES_ID

- Not used as an identifier. Omitted from ETL unique key and from required fields. If we need “reservation = true/false” later, we can add a boolean column and set it from RES_ID; for now we do not store it.
