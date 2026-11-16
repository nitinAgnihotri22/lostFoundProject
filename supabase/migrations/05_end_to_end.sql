-- End-to-end flow: item lifecycle, in-app messaging, photo storage
-- ------------------------------------------------------------------
-- Safe to run more than once. Paste into the Supabase SQL editor.

-- 1. Items: lifecycle timestamps + lookup indexes --------------------
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,                 -- when the poster marked it returned/closed
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- The live claims table was created without ON DELETE CASCADE – deleting an
-- item must take its claims with it.
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_item_id_fkey;
ALTER TABLE claims ADD CONSTRAINT claims_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS items_status_idx     ON items (status);
CREATE INDEX IF NOT EXISTS items_type_idx       ON items (type);
CREATE INDEX IF NOT EXISTS items_user_id_idx    ON items (user_id);
CREATE INDEX IF NOT EXISTS items_created_at_idx ON items (created_at DESC);

-- 2. Conversations (one per item + pair of users) ---------------------
CREATE TABLE IF NOT EXISTS conversations (
  id                   TEXT PRIMARY KEY,
  item_id              TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  -- participants stored in sorted order so (item, pair) is unique regardless of who started it
  user_low             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at      TIMESTAMPTZ,
  last_message_preview TEXT,
  last_sender_id       TEXT,
  created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT conversations_distinct_users CHECK (user_low <> user_high),
  CONSTRAINT conversations_ordered_users  CHECK (user_low < user_high),
  CONSTRAINT conversations_item_pair_key  UNIQUE (item_id, user_low, user_high)
);

CREATE INDEX IF NOT EXISTS conversations_user_low_idx  ON conversations (user_low, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_user_high_idx ON conversations (user_high, last_message_at DESC);

-- 3. Messages ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  read_at         TIMESTAMPTZ,                                     -- set when the recipient opens the thread
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_unread_idx       ON messages (conversation_id) WHERE read_at IS NULL;

-- 4. Keep updated_at current automatically ------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['items', 'claims', 'users', 'conversations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- 5. Public photo bucket (no-op if it already exists) ------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('item-photos', 'item-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- 6. Make PostgREST (Supabase API) pick up the new tables/columns now ----
NOTIFY pgrst, 'reload schema';
