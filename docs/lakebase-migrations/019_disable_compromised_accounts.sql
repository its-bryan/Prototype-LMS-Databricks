-- =============================================================================
-- 019_disable_compromised_accounts.sql — Deactivate accounts with leaked credentials
-- =============================================================================
-- Passwords for these accounts were accidentally committed to the repo.
-- This migration:
--   1. Deactivates all affected accounts (blocks login immediately)
--   2. Invalidates passwords with a random bcrypt hash (cannot be reversed)
--
-- After running, create new credentials via:
--   python -c "import bcrypt; print(bcrypt.hashpw(b'YourNewSecurePassword', bcrypt.gensalt(12)).decode())"
--   UPDATE auth_users SET password_hash = '<new_hash>', is_active = true WHERE email = '...';
-- =============================================================================

-- Deactivate and invalidate all compromised accounts
UPDATE auth_users
SET is_active = false,
    password_hash = '$2b$12$INVALIDATED.CREDENTIAL.LEAK.DO.NOT.REACTIVATE.WITHOUT.NEW.PASS',
    updated_at = now()
WHERE email IN (
    'admin.leo@hertz.com',
    'adamfrankel.leo@hertz.com',
    'jonathanhoover.leo@hertz.com',
    'jeri.leo@hertz.com',
    'rachel.leo@hertz.com'
);

-- Verify
SELECT email, is_active, updated_at FROM auth_users
WHERE email IN (
    'admin.leo@hertz.com',
    'adamfrankel.leo@hertz.com',
    'jonathanhoover.leo@hertz.com',
    'jeri.leo@hertz.com',
    'rachel.leo@hertz.com'
);
