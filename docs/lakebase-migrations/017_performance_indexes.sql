-- Performance indexes for 800K leads scale
-- Run against Lakebase Postgres
-- Note: PostgreSQL requires parentheses around index expressions (e.g. COALESCE).

CREATE INDEX IF NOT EXISTS idx_leads_active_branch_date
  ON leads (branch, (COALESCE(init_dt_final, week_of)) DESC)
  WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_leads_active_status
  ON leads (status)
  WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_leads_active_gm
  ON leads (general_mgr)
  WHERE archived = false;

CREATE INDEX IF NOT EXISTS idx_leads_directive
  ON leads (branch)
  WHERE archived = false AND gm_directive IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_enrichment_todo
  ON leads (branch, status)
  WHERE archived = false AND enrichment_complete = false;
