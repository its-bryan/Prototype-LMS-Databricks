-- =============================================================================
-- 006: Delete all demo data
-- =============================================================================
-- Run in Lakebase SQL editor when you want to clear all demo/test data before
-- loading real data (e.g. before your first HLES upload).
-- Order matters: gm_directives reference leads (no CASCADE), so delete directives
-- first. Tasks and lead_activities have ON DELETE CASCADE from leads.
-- =============================================================================

-- 1) GM directives (must delete before leads — FK has no ON DELETE CASCADE)
DELETE FROM gm_directives;

-- 2) Leads (tasks and lead_activities are deleted automatically via CASCADE)
DELETE FROM leads;

-- 3) Demo seed data (from 002_seed_config.sql)
DELETE FROM user_profiles;
DELETE FROM org_mapping;

-- 4) Upload history and wins/learnings
DELETE FROM upload_summary;
DELETE FROM wins_learnings;

-- Optional: clear other config tables if you want a full reset (uncomment if needed)
-- DELETE FROM cancellation_reason_categories;
-- DELETE FROM next_actions;
-- DELETE FROM branch_managers;
-- DELETE FROM weekly_trends;
-- DELETE FROM leaderboard_data;
-- DELETE FROM lead_activities;  -- already empty after leads delete, but safe to run

-- =============================================================================
-- Verify: SELECT COUNT(*) FROM leads;  -- should be 0
-- =============================================================================
