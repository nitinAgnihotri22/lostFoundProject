-- LostFound Database Schema for PostgreSQL with PostGIS
-- Can be run in Supabase SQL Editor or standard PostgreSQL 14+

-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles / Users Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Items Table (Lost & Found reports)
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('found', 'lost')) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT CHECK (category IN (
    'electronics', 'wallets', 'keys', 'bags', 
    'documents', 'jewelry', 'pets', 'clothing', 'other'
  )) NOT NULL,
  images TEXT[] DEFAULT '{}',
  location GEOGRAPHY(Point, 4326) NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('active', 'claimed', 'resolved')) DEFAULT 'active',
  reward NUMERIC(10, 2) DEFAULT 0,
  verification_questions TEXT[] DEFAULT '{}', -- 3 questions configured by finder
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Claims Table (3 verification proof submission)
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  claimant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  claimant_phone TEXT NOT NULL,
  proof_1 TEXT NOT NULL,
  proof_2 TEXT NOT NULL,
  proof_3 TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  finder_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Spatial Index for ultra-fast 5km radius queries
CREATE INDEX IF NOT EXISTS items_geo_idx ON items USING GIST(location);
CREATE INDEX IF NOT EXISTS items_occurred_at_idx ON items(occurred_at DESC);
CREATE INDEX IF NOT EXISTS items_category_idx ON items(category);
CREATE INDEX IF NOT EXISTS items_status_idx ON items(status);

-- 6. Helper Function: Search Items by Location Radius (in meters)
CREATE OR REPLACE FUNCTION search_items_by_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION DEFAULT 5000,
  item_type TEXT DEFAULT NULL,
  item_category TEXT DEFAULT NULL,
  search_query TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  type TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  images TEXT[],
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  address TEXT,
  occurred_at TIMESTAMPTZ,
  status TEXT,
  reward NUMERIC,
  distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.user_id,
    i.type,
    i.title,
    i.description,
    i.category,
    i.images,
    ST_Y(i.location::geometry) AS lat,
    ST_X(i.location::geometry) AS lng,
    i.address,
    i.occurred_at,
    i.status,
    i.reward,
    ST_Distance(i.location, ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography) AS distance_meters
  FROM items i
  WHERE 
    i.status = 'active'
    AND ST_DWithin(i.location, ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography, radius_meters)
    AND (item_type IS NULL OR i.type = item_type)
    AND (item_category IS NULL OR i.category = item_category)
    AND (
      search_query IS NULL 
      OR i.title ILIKE '%' || search_query || '%' 
      OR i.description ILIKE '%' || search_query || '%'
    )
  ORDER BY distance_meters ASC;
END;
$$;

