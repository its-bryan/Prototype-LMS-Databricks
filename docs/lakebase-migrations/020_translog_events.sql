-- =============================================================================
-- 020: Translog Events — Normalized table for HLES translog data
-- =============================================================================
-- Replaces the leads.translog JSONB column approach with a proper relational
-- table that stores every raw translog event, linked to leads via knum.
-- Events without a matching lead have lead_id = NULL (orphans).
-- =============================================================================

CREATE TABLE translog_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Linkage keys
  source_id bigint,                          -- Original ID from Databricks/CSV
  lead_id bigint REFERENCES leads(id) ON DELETE SET NULL,  -- NULL = orphan/unassigned
  knum text,                                 -- Reservation key (primary join to leads.knum)
  rez_num text,                              -- Rental agreement number (secondary join to leads.confirm_num)
  confirm_num text,                          -- Confirmation number (rarely populated)

  -- Location & branch
  loc_code text,                             -- Branch/location code

  -- Timestamps
  system_date timestamptz,                   -- When event was recorded in system
  application_date timestamptz,              -- When event actually occurred

  -- Event classification
  event_type smallint,                       -- 0-6 event category
  bgn01 text,                                -- Event sub-type code
  stat_flag text,                            -- Status flag (A, 9, 1, 2, etc.)
  sf_trans text,                             -- Transaction reference

  -- Event description (MSG1 is the primary human-readable description)
  msg1 text,                                 -- Primary event description (e.g. "Loc-Customer Contact")
  msg2 text,                                 -- Secondary detail
  msg3 text,                                 -- Additional detail
  msg4 text,                                 -- Additional detail
  msg5 text,                                 -- Application/version info
  msg6 text,                                 -- Employee/entity name
  msg7 text,
  msg8 text,
  msg9 text,
  msg10 text,                                -- Extended detail / CDP info

  -- Employee
  emp_code text,                             -- Employee who performed action
  emp_lname text,
  emp_fname text,

  -- Operational fields
  requested_days int DEFAULT 0,
  timezone_offset smallint DEFAULT 0,        -- Timezone offset from source

  -- Databricks metadata
  load_date date,                            -- When ingested into Databricks
  source_system text,                        -- e.g. "HLES"
  source_region text,                        -- e.g. "USA"

  -- Audit
  created_at timestamptz DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_translog_events_knum ON translog_events(knum);
CREATE INDEX idx_translog_events_lead_id ON translog_events(lead_id);
CREATE INDEX idx_translog_events_loc_code ON translog_events(loc_code);
CREATE INDEX idx_translog_events_system_date ON translog_events(system_date);
CREATE INDEX idx_translog_events_msg1 ON translog_events(msg1);
CREATE INDEX idx_translog_events_orphan ON translog_events(lead_id) WHERE lead_id IS NULL;
CREATE INDEX idx_translog_events_source_id ON translog_events(source_id);

COMMENT ON TABLE translog_events IS 'Raw translog events from HLES system. Linked to leads via knum → leads.knum OR rez_num → leads.confirm_num. NULL lead_id = orphan/unassigned.';
COMMENT ON COLUMN translog_events.source_id IS 'Original row ID from Databricks hles_translog table';
COMMENT ON COLUMN translog_events.knum IS 'Reservation key — primary join to leads.knum';
COMMENT ON COLUMN translog_events.rez_num IS 'Rental agreement number — secondary join to leads.confirm_num';
COMMENT ON COLUMN translog_events.msg1 IS 'Primary event description (e.g. Loc-Customer Contact, Rez-Cancelled)';
