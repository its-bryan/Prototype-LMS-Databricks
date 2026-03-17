-- =============================================================================
-- Hertz LMS — Seed Config Data for Lakebase Postgres
-- =============================================================================
-- Run AFTER 001_full_schema.sql
-- Seeds: cancellation reason categories, next actions, org mapping, demo users
-- =============================================================================

-- =============================================================================
-- Cancellation reason categories (dropdown config)
-- =============================================================================
INSERT INTO cancellation_reason_categories (category, reasons, sort_order) VALUES
  ('Customer Unreachable', '["Unable to reach — no answer after multiple attempts","Invalid or disconnected phone number","Customer requested callback — never answered"]'::jsonb, 1),
  ('Customer Decision', '["Found better rate elsewhere","Changed travel plans","Decided not to rent","Rented from competitor"]'::jsonb, 2),
  ('Operational', '["No-show after confirmation","Documentation issues — could not complete","Vehicle availability — customer declined alternative"]'::jsonb, 3),
  ('Other', '["Duplicate reservation","Test or training lead","Other (see notes)"]'::jsonb, 4);

-- =============================================================================
-- Next actions (BM follow-up dropdown config)
-- =============================================================================
INSERT INTO next_actions (action, sort_order) VALUES
  ('Call again', 1),
  ('Send follow-up SMS', 2),
  ('Escalate to AM', 3),
  ('Close — no further action', 4),
  ('Verify documentation', 5),
  ('Other (see notes)', 6);

-- =============================================================================
-- Org mapping (sample BM -> Branch -> AM -> GM -> Zone hierarchy)
-- =============================================================================
INSERT INTO org_mapping (bm, branch, am, gm, zone) VALUES
  ('J. Smith', 'Downtown LA', 'K. Chen', 'D. Williams', 'Eastern'),
  ('M. Johnson', 'Santa Monica', 'K. Chen', 'D. Williams', 'Eastern'),
  ('A. Garcia', 'Pasadena', 'K. Chen', 'D. Williams', 'Eastern'),
  ('S. Lee', 'Long Beach', 'K. Chen', 'D. Williams', 'Eastern'),
  ('T. Brown', 'Anaheim', 'K. Chen', 'D. Williams', 'Eastern'),
  ('R. Davis', 'San Diego Central', 'L. Park', 'R. Martinez', 'Southern'),
  ('E. Wilson', 'La Jolla', 'L. Park', 'R. Martinez', 'Southern'),
  ('P. Taylor', 'Carlsbad', 'L. Park', 'R. Martinez', 'Southern'),
  ('C. Anderson', 'Mission Valley', 'L. Park', 'R. Martinez', 'Southern'),
  ('N. Thomas', 'Chula Vista', 'L. Park', 'R. Martinez', 'Southern'),
  ('B. Jackson', 'Sacramento North', 'M. Nguyen', null, 'Northern'),
  ('D. White', 'Roseville', 'M. Nguyen', 'R. Martinez', 'Northern'),
  ('F. Harris', 'Folsom', 'M. Nguyen', 'R. Martinez', 'Northern'),
  ('G. Clark', 'Elk Grove', 'M. Nguyen', null, 'Northern'),
  ('H. Lewis', 'Davis', 'M. Nguyen', 'R. Martinez', 'Northern');

-- =============================================================================
-- Demo user profiles
-- These use generated UUIDs. Replace with real user IDs when connecting auth.
-- =============================================================================
INSERT INTO user_profiles (id, role, display_name, branch) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'bm', 'J. Smith', 'Downtown LA'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'bm', 'M. Johnson', 'Santa Monica'),
  ('a1b2c3d4-0000-0000-0000-000000000003', 'gm', 'D. Williams', null),
  ('a1b2c3d4-0000-0000-0000-000000000004', 'admin', 'Admin User', null);

-- =============================================================================
-- Verify: SELECT * FROM cancellation_reason_categories ORDER BY sort_order;
--         SELECT * FROM next_actions ORDER BY sort_order;
--         SELECT * FROM org_mapping LIMIT 5;
--         SELECT * FROM user_profiles;
-- =============================================================================
