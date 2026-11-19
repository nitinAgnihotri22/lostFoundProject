-- Maker-checker review for posts + "checker" admin role
-- ------------------------------------------------------------------
-- Safe to run more than once. Run AFTER 07_admin_panel.sql.
--
-- Every new post starts as 'pending' and only appears on the website
-- once a checker or super admin approves it. Posts that already exist
-- when this runs are marked 'approved', so nothing disappears.
-- ------------------------------------------------------------------

-- 1. Review state on items -------------------------------------------------
-- Added with DEFAULT 'approved' so existing rows are backfilled as live …
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS review_note   TEXT,          -- reason shown to the poster when rejected
  ADD COLUMN IF NOT EXISTS reviewed_by   TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ;
-- … then new rows default to 'pending' (the API also sets it explicitly).
ALTER TABLE items ALTER COLUMN review_status SET DEFAULT 'pending';

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_review_status_check;
ALTER TABLE items ADD  CONSTRAINT items_review_status_check
  CHECK (review_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS items_review_status_idx ON items (review_status, created_at);

-- 2. New admin role: checker (reviews posts) --------------------------------
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD  CONSTRAINT admin_users_role_check
  CHECK (role IN ('super_admin', 'sub_admin', 'checker'));

NOTIFY pgrst, 'reload schema';
