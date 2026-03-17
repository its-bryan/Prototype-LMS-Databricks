-- =============================================================================
-- 004: Add missing columns to leads + re-GRANT for app (run in Lakebase SQL Editor)
-- =============================================================================
-- 1. Migration: add columns and indexes
-- 2. GRANTs: ensure app (hertz-leo-leadsmgmtsystem) has access to all tables
-- =============================================================================

-- ---------- Migration 004: New columns and bm_name nullable ----------
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
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_email text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_phone text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_status text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mismatch_reason text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_upload_id bigint;
ALTER TABLE leads ALTER COLUMN bm_name DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_zone ON leads(zone);
CREATE INDEX IF NOT EXISTS idx_leads_week_of ON leads(week_of);
CREATE INDEX IF NOT EXISTS idx_leads_general_mgr ON leads(general_mgr);

-- ---------- GRANTs: App service principal (hertz-leo-leadsmgmtsystem) ----------
-- Replace <APP_CLIENT_ID> with the app's client ID from: databricks apps get hertz-leo-leadsmgmtsystem
-- Current value from app: 35332971-a7c4-4c58-ae96-f473ccb07c49
GRANT USAGE ON SCHEMA public TO "35332971-a7c4-4c58-ae96-f473ccb07c49";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "35332971-a7c4-4c58-ae96-f473ccb07c49";
