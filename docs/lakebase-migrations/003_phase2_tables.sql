-- =============================================================================
-- Phase 2: GM Directives + Wins & Learnings tables
-- Run in Lakebase SQL editor (select your databricks_postgres database first)
-- =============================================================================

-- =============================================================================
-- 12. GM DIRECTIVES: Per-lead instructions from GM to BM
-- =============================================================================
CREATE TABLE IF NOT EXISTS gm_directives (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id bigint NOT NULL REFERENCES leads(id),
  directive_text text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  due_date date,
  created_by uuid,
  created_by_name text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_gm_directives_lead_id ON gm_directives(lead_id);
CREATE INDEX idx_gm_directives_created_at ON gm_directives(created_at);

-- =============================================================================
-- 13. WINS & LEARNINGS: BM weekly meeting prep submissions
-- =============================================================================
CREATE TABLE IF NOT EXISTS wins_learnings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bm_name text NOT NULL,
  branch text NOT NULL,
  gm_name text,
  content text NOT NULL,
  week_of date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_wins_learnings_branch ON wins_learnings(branch);
CREATE INDEX idx_wins_learnings_week_of ON wins_learnings(week_of);

-- =============================================================================
-- IMPORTANT: Grant the Databricks App access to these new tables.
-- Replace <CLIENT_ID> with your app's DATABRICKS_CLIENT_ID.
-- =============================================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gm_directives TO "<CLIENT_ID>";
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wins_learnings TO "<CLIENT_ID>";
-- =============================================================================
