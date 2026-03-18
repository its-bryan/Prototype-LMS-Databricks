-- =============================================================================
-- 008: Pre-computed Dashboard Snapshots
-- =============================================================================
-- Stores JSONB snapshots of dashboard metrics computed after each HLES upload.
-- Frontend fetches the latest snapshot for instant initial rendering.
-- =============================================================================

CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot   jsonb  NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_created_at
  ON dashboard_snapshots (created_at DESC);

-- ---------- GRANTs: App service principal (hertz-leo-leadsmgmtsystem) ----------
GRANT SELECT, INSERT ON dashboard_snapshots TO "35332971-a7c4-4c58-ae96-f473ccb07c49";
