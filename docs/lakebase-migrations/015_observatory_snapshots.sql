-- Observatory Tower: company-wide charts snapshot
-- Separate from dashboard_snapshots to keep payloads independent.

CREATE TABLE IF NOT EXISTS observatory_snapshots (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot   jsonb  NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_observatory_snapshots_created_at
  ON observatory_snapshots (created_at DESC);
