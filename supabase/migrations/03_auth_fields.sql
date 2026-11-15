-- Auth fields for custom login / register endpoints
-- -------------------------------------------------
-- role_type   : 'social' (OAuth, no password) | 'email' (email + password)
-- role_source : 'google' | 'normal_register'
--
-- Safe to run more than once.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_source      TEXT DEFAULT 'normal_register',
  ADD COLUMN IF NOT EXISTS role_type        TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS password_hash    TEXT,          -- NULL for social accounts
  ADD COLUMN IF NOT EXISTS auth_provider_id TEXT,          -- Supabase auth user id for social logins
  ADD COLUMN IF NOT EXISTS last_login_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Backfill any NULLs left by earlier rows before tightening constraints
UPDATE users SET role_source = 'normal_register' WHERE role_source IS NULL;
UPDATE users SET role_type   = 'email'           WHERE role_type   IS NULL;

ALTER TABLE users ALTER COLUMN role_source SET NOT NULL;
ALTER TABLE users ALTER COLUMN role_type   SET NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_source_check;
ALTER TABLE users ADD  CONSTRAINT users_role_source_check
  CHECK (role_source IN ('google', 'normal_register'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_type_check;
ALTER TABLE users ADD  CONSTRAINT users_role_type_check
  CHECK (role_type IN ('social', 'email'));

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_provider_id_key
  ON users (auth_provider_id) WHERE auth_provider_id IS NOT NULL;

-- Case-insensitive email lookups
CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

-- Make PostgREST (Supabase API) pick up the new columns immediately
NOTIFY pgrst, 'reload schema';
