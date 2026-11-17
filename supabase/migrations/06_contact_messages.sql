-- Contact Us form submissions
-- ------------------------------------------------------------------
-- Safe to run more than once. Paste into the Supabase SQL editor.
-- Written only by POST /api/contact (service role); no public access.

CREATE TABLE IF NOT EXISTS contact_messages (
  id          TEXT PRIMARY KEY,
  reference   TEXT NOT NULL UNIQUE,                          -- short code shown to the sender, e.g. LF-7K2Q9X
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  subject     TEXT NOT NULL,                                 -- general | listing | claim | account | accessibility | partnership | other
  message     TEXT NOT NULL,
  lang        TEXT NOT NULL DEFAULT 'en',                    -- language the sender was using (en | hi)
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,  -- set when the sender was signed in
  page_url    TEXT,
  user_agent  TEXT,
  status      TEXT NOT NULL DEFAULT 'new',                   -- new | in_progress | resolved | spam
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_status_idx     ON contact_messages (status);
CREATE INDEX IF NOT EXISTS contact_messages_email_idx      ON contact_messages (lower(email));

-- Row level security on, with no policies: only the service role (the API) can read or write.
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
