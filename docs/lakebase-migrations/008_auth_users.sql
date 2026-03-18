-- =============================================================================
-- 008_auth_users.sql — MVP authentication table for LEO
-- =============================================================================
-- Run in Lakebase SQL Editor (lms-leo / production).
-- After INSERT, re-run GRANTs for the app service principal.
--
-- Passwords are bcrypt-hashed. To change a password:
--   python -c "import bcrypt; print(bcrypt.hashpw(b'NewPass123', bcrypt.gensalt(12)).decode())"
-- Then: UPDATE auth_users SET password_hash = '<hash>' WHERE email = '...';
--
-- To add a user:
--   INSERT INTO auth_users (email, password_hash, role, display_name, branch)
--   VALUES ('new.user@hertz.com', '<bcrypt hash>', 'bm', 'New User', '7401-01 - PERRINE HLE');
--
-- When Hertz SSO is ready, this table can be dropped.
-- =============================================================================

CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('bm', 'gm', 'admin')),
  display_name text NOT NULL,
  branch text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);

COMMENT ON TABLE auth_users IS 'MVP auth — replaced by Hertz SSO later. Passwords are bcrypt-hashed.';
COMMENT ON COLUMN auth_users.branch IS 'For BM role: the branch they manage. Null for GM/Admin.';
COMMENT ON COLUMN auth_users.is_active IS 'Set false to disable login without deleting the row.';

-- Seed 3 MVP users
INSERT INTO auth_users (email, password_hash, role, display_name, branch) VALUES
  ('admin.leo@hertz.com',          '$2b$12$NDgnCzjE4sdutqA7RkKB2u0VcGjLxfPBOBBLyxDT25Q6jQpolwSgi', 'admin', 'Leo Admin',       NULL),
  ('adamfrankel.leo@hertz.com',    '$2b$12$RqJxDvUBuBSR2iFw.eGRCOPlZ2CYTdGDY0YcrvohqFtKkuGsBqQGO', 'gm',    'Adam Frankel',    NULL),
  ('jonathanhoover.leo@hertz.com', '$2b$12$0OkbnzdIlM3K0HmGunSuteOl8HLVkyPW4cF1yd.yiJ.ceQVP0rKNe', 'bm',    'Jonathan Hoover', '7467-09 - DORAL HLE')
ON CONFLICT (email) DO NOTHING;

-- Re-GRANT for the app service principal (replace <APP_CLIENT_ID> with your actual value)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON auth_users TO "<APP_CLIENT_ID>";

-- Verify
SELECT id, email, role, display_name, branch, is_active FROM auth_users ORDER BY role;
