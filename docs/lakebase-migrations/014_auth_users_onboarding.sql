-- =============================================================================
-- 014_auth_users_onboarding.sql — Add onboarding_completed_at to auth_users
-- =============================================================================
-- Run in Lakebase SQL Editor (lms-leo / production).
-- Tracks whether a user has completed or skipped the onboarding tour.
-- NULL = show tour on next login; non-null = skip auto-open (user can replay via ? button).
-- =============================================================================

ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN auth_users.onboarding_completed_at IS 'When user completed or skipped onboarding tour; null = show tour on next login';

-- Verify
SELECT id, email, role, display_name, onboarding_completed_at FROM auth_users ORDER BY role;
