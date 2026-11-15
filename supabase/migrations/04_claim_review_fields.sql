-- Claim review fields: rejection reason + one claim per user per item
-- ------------------------------------------------------------------
-- Safe to run more than once.

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,          -- required when status = 'rejected'
  ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ,   -- when the poster approved/rejected
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Older rejected rows may have their reason in finder_notes – copy it across.
UPDATE claims
   SET rejection_reason = finder_notes
 WHERE status = 'rejected' AND rejection_reason IS NULL AND finder_notes IS NOT NULL;

-- A rejected claim must carry a reason (NOT VALID: don't fail on legacy rows without one).
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_rejection_reason_check;
ALTER TABLE claims ADD  CONSTRAINT claims_rejection_reason_check
  CHECK (status <> 'rejected' OR length(trim(coalesce(rejection_reason, ''))) > 0) NOT VALID;

ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_rejection_reason_length;
ALTER TABLE claims ADD  CONSTRAINT claims_rejection_reason_length
  CHECK (rejection_reason IS NULL OR length(rejection_reason) <= 300);

-- One claim per user per item (also blocks re-claiming after a rejection).
-- If this fails, find duplicates with:
--   SELECT item_id, claimant_id, count(*) FROM claims GROUP BY 1, 2 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS claims_item_claimant_key
  ON claims (item_id, claimant_id) WHERE claimant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS claims_item_id_idx     ON claims (item_id);
CREATE INDEX IF NOT EXISTS claims_claimant_id_idx ON claims (claimant_id);

-- Make PostgREST (Supabase API) pick up the new columns immediately
NOTIFY pgrst, 'reload schema';
