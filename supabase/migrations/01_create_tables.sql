-- Supabase PostgreSQL schema for LostFound app
-- Run this before migration (e.g. via Supabase SQL editor or psql)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  type TEXT CHECK (type IN ('found','lost')) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  images TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('active','claimed','resolved')) DEFAULT 'active',
  user_id TEXT REFERENCES users(id),
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  reward NUMERIC DEFAULT 0,
  verification_questions TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Claims table
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
  item_title TEXT NOT NULL,
  claimant_id TEXT REFERENCES users(id),
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  claimant_phone TEXT NOT NULL,
  proof_1 TEXT NOT NULL,
  proof_2 TEXT NOT NULL,
  proof_3 TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  finder_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
