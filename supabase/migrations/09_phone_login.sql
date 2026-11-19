-- Phone (OTP) sign-in
-- ------------------------------------------------------------------
-- Safe to run more than once. Run AFTER 08_post_review.sql.
--
--  * Phone-only accounts may have no email, so users.email becomes optional
--    (still unique when present).
--  * phone_e164 holds a phone number verified by OTP (e.g. +919876543210);
--    one account per verified number.
--  * phone_digits is the digits of the free-text `phone` column, so older
--    accounts can be found by the number they typed at sign-up.
-- ------------------------------------------------------------------

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_e164        TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone_digits') THEN
    ALTER TABLE users ADD COLUMN phone_digits TEXT
      GENERATED ALWAYS AS (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) STORED;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_e164_key ON users (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_phone_digits_idx ON users (phone_digits);

-- New sign-in type
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_source_check;
ALTER TABLE users ADD  CONSTRAINT users_role_source_check CHECK (role_source IN ('google', 'normal_register', 'phone'));
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_type_check;
ALTER TABLE users ADD  CONSTRAINT users_role_type_check CHECK (role_type IN ('social', 'email', 'phone'));

NOTIFY pgrst, 'reload schema';
