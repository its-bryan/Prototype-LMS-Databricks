-- =============================================================================
-- 005: Confirmation Number as business key; reservation_id optional
-- =============================================================================
-- Run after 004. Makes confirm_num the unique business identifier; reservation_id
-- becomes optional (we set it = confirm_num for display, but no longer require it).
-- =============================================================================

-- Allow reservation_id to be null (HLES uses CONFIRM_NUM as UUID, not RES_ID)
ALTER TABLE leads ALTER COLUMN reservation_id DROP NOT NULL;

-- Uniqueness for confirm_num so we can match/upsert by confirmation number
-- (Existing rows may have null confirm_num; new uploads will always set it.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_confirm_num_unique
  ON leads (confirm_num) WHERE confirm_num IS NOT NULL;

-- =============================================================================
-- Optional: backfill reservation_id from confirm_num for existing rows
-- so "Reservation #" in the UI shows confirmation number. Uncomment if desired:
-- UPDATE leads SET reservation_id = confirm_num WHERE confirm_num IS NOT NULL AND (reservation_id IS NULL OR reservation_id = '');
-- =============================================================================
