-- =============================================================================
-- 009_grant_auth_users.sql — Grant app service principal access to auth_users
-- =============================================================================
-- Run in Lakebase SQL Editor (lms-leo / production).
-- Fixes: "permission denied for table auth_users"
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON auth_users TO "35332971-a7c4-4c58-ae96-f473ccb07c49";

-- Verify
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'auth_users';
