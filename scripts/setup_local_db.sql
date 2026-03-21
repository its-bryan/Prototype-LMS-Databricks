\set ON_ERROR_STOP on

-- Local DB bootstrap for LMS (schema + seed + migration ledger)
-- Usage:
--   psql -d lms_leo -f scripts/setup_local_db.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

\echo Applying 001_full_schema.sql
\i docs/lakebase-migrations/001_full_schema.sql
INSERT INTO schema_migrations (id) VALUES ('001_full_schema') ON CONFLICT DO NOTHING;

\echo Applying 002_seed_config.sql
\i docs/lakebase-migrations/002_seed_config.sql
INSERT INTO schema_migrations (id) VALUES ('002_seed_config') ON CONFLICT DO NOTHING;

\echo Applying 003_phase2_tables.sql
\i docs/lakebase-migrations/003_phase2_tables.sql
INSERT INTO schema_migrations (id) VALUES ('003_phase2_tables') ON CONFLICT DO NOTHING;

\echo Applying 004_add_lead_columns.sql
\i docs/lakebase-migrations/004_add_lead_columns.sql
INSERT INTO schema_migrations (id) VALUES ('004_add_lead_columns') ON CONFLICT DO NOTHING;

\echo Applying 005_confirm_num_unique_reservation_id_nullable.sql
\i docs/lakebase-migrations/005_confirm_num_unique_reservation_id_nullable.sql
INSERT INTO schema_migrations (id) VALUES ('005_confirm_num_unique_reservation_id_nullable') ON CONFLICT DO NOTHING;

\echo Applying 006_delete_demo_data.sql
\i docs/lakebase-migrations/006_delete_demo_data.sql
INSERT INTO schema_migrations (id) VALUES ('006_delete_demo_data') ON CONFLICT DO NOTHING;

\echo Applying 007_bm_from_employee_listing_frankel.sql
\i docs/lakebase-migrations/007_bm_from_employee_listing_frankel.sql
INSERT INTO schema_migrations (id) VALUES ('007_bm_from_employee_listing_frankel') ON CONFLICT DO NOTHING;

\echo Applying 007a_export_branches_for_bm_mapping.sql
\i docs/lakebase-migrations/007a_export_branches_for_bm_mapping.sql
INSERT INTO schema_migrations (id) VALUES ('007a_export_branches_for_bm_mapping') ON CONFLICT DO NOTHING;

\echo Applying 008_auth_users.sql
\i docs/lakebase-migrations/008_auth_users.sql
INSERT INTO schema_migrations (id) VALUES ('008_auth_users') ON CONFLICT DO NOTHING;

\echo Applying 008_dashboard_snapshots.sql (local-safe, GRANT removed)
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_created_at
  ON dashboard_snapshots (created_at DESC);
INSERT INTO schema_migrations (id) VALUES ('008_dashboard_snapshots') ON CONFLICT DO NOTHING;

\echo Applying 009_grant_auth_users.sql (skipped in local; GRANT not required)
INSERT INTO schema_migrations (id) VALUES ('009_grant_auth_users') ON CONFLICT DO NOTHING;

\echo Applying 014_auth_users_onboarding.sql
\i docs/lakebase-migrations/014_auth_users_onboarding.sql
INSERT INTO schema_migrations (id) VALUES ('014_auth_users_onboarding') ON CONFLICT DO NOTHING;

\echo Applying 015_observatory_snapshots.sql
\i docs/lakebase-migrations/015_observatory_snapshots.sql
INSERT INTO schema_migrations (id) VALUES ('015_observatory_snapshots') ON CONFLICT DO NOTHING;

\echo Applying 016_feedback_feature_requests.sql (local-safe, GRANT removed)
CREATE TABLE IF NOT EXISTS feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback_text text,
  comments text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);

CREATE TABLE IF NOT EXISTS feature_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  requester_name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  current_process text,
  frequency text,
  time_spent text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created_at
  ON feature_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS feature_request_upvotes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feature_request_id bigint NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_feature_request_user UNIQUE (feature_request_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_feature_request_upvotes_request_id
  ON feature_request_upvotes (feature_request_id);
INSERT INTO schema_migrations (id) VALUES ('016_feedback_feature_requests') ON CONFLICT DO NOTHING;

\echo Applying 017_performance_indexes.sql
\i docs/lakebase-migrations/017_performance_indexes.sql
INSERT INTO schema_migrations (id) VALUES ('017_performance_indexes') ON CONFLICT DO NOTHING;

\echo setup_local_db.sql complete.
