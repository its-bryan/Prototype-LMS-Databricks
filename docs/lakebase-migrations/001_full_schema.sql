-- =============================================================================
-- Hertz LMS — Combined Schema for Lakebase Postgres
-- =============================================================================
-- Source: Supabase migrations 001–015 (stripped of RLS, policies, auth.users refs)
-- Run this in your Lakebase Postgres SQL editor or via psql.
-- Creates 11 tables: org_mapping, leads, branch_managers, weekly_trends,
--   upload_summary, leaderboard_data, cancellation_reason_categories,
--   next_actions, user_profiles, tasks, lead_activities
-- =============================================================================

-- Extension (wrapped in IF NOT EXISTS for safety)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ORG MAPPING: BM -> Branch -> AM -> GM -> Zone hierarchy
-- Source: 001_initial_schema.sql
-- =============================================================================
CREATE TABLE org_mapping (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bm text NOT NULL,
  branch text NOT NULL,
  am text NOT NULL,
  gm text,
  zone text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(branch)
);

-- =============================================================================
-- 2. LEADS: Main lead/reservation data
-- Source: 001_initial_schema.sql + 006 (email, phone) + 015 (init_dt_final)
-- =============================================================================
CREATE TABLE leads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer text NOT NULL,
  reservation_id text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('Rented', 'Cancelled', 'Unused', 'Reviewed')),
  archived boolean DEFAULT false,
  enrichment_complete boolean DEFAULT false,
  branch text NOT NULL,
  bm_name text NOT NULL,
  days_open int DEFAULT 0,
  mismatch boolean DEFAULT false,
  gm_directive text,
  insurance_company text,
  time_to_first_contact text,
  first_contact_by text CHECK (first_contact_by IN ('branch', 'hrd', 'none')),
  time_to_cancel text,
  hles_reason text,
  last_activity timestamptz,
  -- JSONB for nested structures (translog, enrichment, enrichment_log)
  translog jsonb DEFAULT '[]'::jsonb,
  enrichment jsonb,
  enrichment_log jsonb DEFAULT '[]'::jsonb,
  -- Contact fields (from 006_lead_contact_fields)
  email text,
  phone text,
  -- Received date (from 015_add_init_dt_final)
  init_dt_final date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_branch ON leads(branch);
CREATE INDEX idx_leads_archived ON leads(archived);
CREATE INDEX idx_leads_enrichment_complete ON leads(enrichment_complete);

COMMENT ON COLUMN leads.email IS 'Customer email — HLES/TRANSLOG or BM enrichment';
COMMENT ON COLUMN leads.phone IS 'Customer phone (E.164) — HLES/TRANSLOG or BM enrichment';
COMMENT ON COLUMN leads.init_dt_final IS 'Date the reservation was initially received (INIT_DT_FINAL from HLES feed)';

-- =============================================================================
-- 3. BRANCH MANAGERS: BM metrics
-- Source: 001_initial_schema.sql
-- =============================================================================
CREATE TABLE branch_managers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  conversion_rate int NOT NULL,
  quartile int NOT NULL CHECK (quartile BETWEEN 1 AND 4),
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 4. WEEKLY TRENDS: BM and GM weekly metrics
-- Source: 001_initial_schema.sql
-- =============================================================================
CREATE TABLE weekly_trends (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('bm', 'gm')),
  week_label text NOT NULL,
  week_start date NOT NULL,
  -- BM metrics
  total_leads int,
  conversion_rate int,
  comment_rate int,
  -- GM metrics
  cancelled_unreviewed int,
  comment_compliance int,
  zone_conversion_rate int,
  time_to_contact jsonb,
  branch_contact_rate int,
  hrd_contact_rate int,
  created_at timestamptz DEFAULT now(),
  UNIQUE(type, week_start)
);

-- =============================================================================
-- 5. UPLOAD SUMMARY: Last HLES/TRANSLOG upload stats
-- Source: 001_initial_schema.sql
-- =============================================================================
CREATE TABLE upload_summary (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hles jsonb NOT NULL,
  translog jsonb NOT NULL,
  data_as_of_date text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 6. LEADERBOARD: Cached leaderboard data (optional — can be computed)
-- Source: 001_initial_schema.sql
-- =============================================================================
CREATE TABLE leaderboard_data (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  branches jsonb,
  gms jsonb,
  ams jsonb,
  zones jsonb,
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 7. CANCELLATION REASON CATEGORIES: Config for dropdowns
-- Source: 001_initial_schema.sql
-- =============================================================================
CREATE TABLE cancellation_reason_categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category text NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 8. NEXT ACTIONS: Config for BM follow-up dropdown
-- Source: 001_initial_schema.sql
-- =============================================================================
CREATE TABLE next_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL UNIQUE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 9. USER PROFILES: Role assignment (BM, GM, Admin)
-- Source: 003_user_profiles.sql + 004 (branch) + 006 (phone) + 013 (onboarding)
-- Note: auth.users FK removed — id is just a uuid primary key
-- =============================================================================
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('bm', 'gm', 'admin')),
  display_name text,
  -- Branch location for BM role (from 004_user_profiles_branch)
  branch text,
  -- BM phone for click-to-call (from 006_lead_contact_fields)
  phone text,
  -- Onboarding tracking (from 013_onboarding_completed_at)
  onboarding_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN user_profiles.branch IS 'Branch location for BM role; null for gm/admin';
COMMENT ON COLUMN user_profiles.phone IS 'BM phone (E.164) for Twilio click-to-call';
COMMENT ON COLUMN user_profiles.onboarding_completed_at IS 'When user completed or skipped first-time onboarding; null = show onboarding';

-- =============================================================================
-- 10. TASKS: GM-assigned and auto-created tasks
-- Source: 005_tasks.sql + 009 (lead FK, priority) + 010 (notes, completed_at, names) + 012 (notes_log)
-- Note: auth.users FKs removed — assigned_to/created_by are just uuids
-- =============================================================================
CREATE TABLE tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  description text,
  due_date date,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Done')),
  assigned_to uuid,
  created_by uuid,
  lead_id bigint NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  source text DEFAULT 'gm_assigned' CHECK (source IN ('gm_assigned', 'auto_translog', 'auto_other')),
  translog_event_id bigint,
  -- Priority (from 009_tasks_lead_fk_and_priority)
  priority text NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Urgent', 'High', 'Normal', 'Low')),
  -- BM work notes (from 010_tasks_notes_completed_at)
  notes text,
  completed_at timestamptz,
  created_by_name text,
  assigned_to_name text,
  -- Append-only notes log (from 012_tasks_notes_log)
  notes_log jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX idx_tasks_priority ON tasks(priority);

COMMENT ON COLUMN tasks.priority IS 'Task priority for triage and display order';
COMMENT ON COLUMN tasks.notes IS 'BM work notes (e.g. call attempts, follow-up details)';
COMMENT ON COLUMN tasks.completed_at IS 'Set when status changes to Done';
COMMENT ON COLUMN tasks.created_by_name IS 'Display name of task creator (GM)';
COMMENT ON COLUMN tasks.assigned_to_name IS 'Display name of assignee (BM)';
COMMENT ON COLUMN tasks.notes_log IS 'Append-only log of task notes with timestamp and author (like enrichment_log)';

-- =============================================================================
-- 11. LEAD ACTIVITIES: Contact actions (Email, SMS, Call)
-- Source: 008_lead_activities.sql
-- Note: auth.users FK removed — performed_by is just a uuid
-- =============================================================================
CREATE TABLE lead_activities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id bigint NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('email', 'sms', 'call')),
  performed_by uuid,
  performed_by_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX idx_lead_activities_created_at ON lead_activities(created_at);

COMMENT ON TABLE lead_activities IS 'Contact activities (email, SMS, call) on leads';
COMMENT ON COLUMN lead_activities.metadata IS 'External IDs + content: for email: id, subject, body, to; for SMS: sid; for call: callSid';

-- =============================================================================
-- Done. Verify with: SELECT table_name FROM information_schema.tables
--                     WHERE table_schema = 'public' ORDER BY table_name;
-- =============================================================================
