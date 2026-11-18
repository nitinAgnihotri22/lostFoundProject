-- Admin panel (/admin)
-- ------------------------------------------------------------------
-- Safe to run more than once. Paste into the Supabase SQL editor.
-- Also creates the contact_messages table from 06 if it is missing.
--
-- Admins live in their own table, separate from website users, so a
-- website account can never sign in to /admin and an admin session is
-- never accepted by the website.
--
-- After running this, create the first super admin with:
--   npm run admin:create
-- ------------------------------------------------------------------

-- 1. Admin accounts ----------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  password_hash    TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'sub_admin' CHECK (role IN ('super_admin', 'sub_admin')),
  status           TEXT NOT NULL DEFAULT 'active'    CHECK (status IN ('active', 'disabled')),
  -- Bumped on password change / disable / "sign out everywhere": every older session stops working.
  session_version  INTEGER NOT NULL DEFAULT 1,
  must_change_password BOOLEAN NOT NULL DEFAULT false,   -- set when another admin chose the password
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until     TIMESTAMPTZ,
  last_login_at    TIMESTAMPTZ,
  created_by       TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_key ON admin_users (lower(email));

-- 2. Website users: disable / enable ----------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS disabled_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_by_admin TEXT REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD  CONSTRAINT users_status_check CHECK (status IN ('active', 'disabled'));
CREATE INDEX IF NOT EXISTS users_status_idx     ON users (status);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC);

-- 3. Items: admin moderation (hidden posts disappear from the website) --
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS is_hidden     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT,
  ADD COLUMN IF NOT EXISTS hidden_by     TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  -- 'admin' = hidden by hand; 'user_disabled' = hidden because the poster was disabled
  -- (those come back automatically when the account is re-enabled).
  ADD COLUMN IF NOT EXISTS hidden_source TEXT;
CREATE INDEX IF NOT EXISTS items_is_hidden_idx ON items (is_hidden);
CREATE INDEX IF NOT EXISTS items_city_idx      ON items (lower(city));

-- 4. Contact messages: admin workflow ----------------------------------
-- Same table as 06_contact_messages.sql, created here too in case 06 wasn't run.
CREATE TABLE IF NOT EXISTS contact_messages (
  id          TEXT PRIMARY KEY,
  reference   TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  lang        TEXT NOT NULL DEFAULT 'en',
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  page_url    TEXT,
  user_agent  TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_status_idx     ON contact_messages (status);
CREATE INDEX IF NOT EXISTS contact_messages_email_idx      ON contact_messages (lower(email));
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS admin_note  TEXT,
  ADD COLUMN IF NOT EXISTS handled_by  TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS contact_messages_status_check;
ALTER TABLE contact_messages ADD  CONSTRAINT contact_messages_status_check
  CHECK (status IN ('new', 'in_progress', 'resolved', 'spam'));

-- 5. Static page content (Privacy, Terms, About, Contact) --------------
-- One row per page + language. No row = the built-in default text is shown.
CREATE TABLE IF NOT EXISTS site_pages (
  slug        TEXT NOT NULL CHECK (slug IN ('privacy', 'terms', 'about', 'contact')),
  lang        TEXT NOT NULL CHECK (lang IN ('en', 'hi')),
  title       TEXT,                         -- optional override of the page heading
  body        TEXT NOT NULL,                -- Markdown (## headings, paragraphs, - bullets, **bold**, [links](url))
  updated_by  TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (slug, lang)
);

-- Company / contact / grievance details used across the site (single row, key = 'site').
CREATE TABLE IF NOT EXISTS site_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Audit log: who did what in the admin panel -------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  admin_email TEXT,
  action      TEXT NOT NULL,                -- e.g. item.hide, user.disable, page.publish
  target_type TEXT,
  target_id   TEXT,
  details     JSONB,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx   ON admin_audit_log (admin_id, created_at DESC);

-- 7. updated_at triggers (same function as 05_end_to_end.sql; re-created in case 05 wasn't run)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['admin_users', 'contact_messages'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- 8. Row level security on, no policies: only the service role (the API) can touch these.
ALTER TABLE admin_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_pages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
