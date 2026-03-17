-- =============================================================================
-- 004: Add missing columns to leads table for HLES upload + frontend parity
-- =============================================================================
-- Run in Lakebase SQL editor after 001/002/003 are applied.
-- These columns are expected by databricksData.js leadFromRow() and by the
-- corrected ETL column mappings in etl/clean.py.
-- =============================================================================

-- HLES-sourced fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS confirm_num text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS knum text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS body_shop text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cdp_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS htz_region text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS set_state text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zone text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS area_mgr text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS general_mgr text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rent_loc text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS week_of date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_range text;

-- Enrichment / display fields expected by the frontend
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_email text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_phone text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_status text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mismatch_reason text;

-- Upload tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_upload_id bigint;

-- BM name is NOT NULL but HLES files don't contain BM — make nullable
ALTER TABLE leads ALTER COLUMN bm_name DROP NOT NULL;

-- Indexes for commonly filtered columns
CREATE INDEX IF NOT EXISTS idx_leads_zone ON leads(zone);
CREATE INDEX IF NOT EXISTS idx_leads_week_of ON leads(week_of);
CREATE INDEX IF NOT EXISTS idx_leads_general_mgr ON leads(general_mgr);

-- =============================================================================
-- Verify: SELECT column_name FROM information_schema.columns
--         WHERE table_name = 'leads' ORDER BY ordinal_position;
-- =============================================================================
