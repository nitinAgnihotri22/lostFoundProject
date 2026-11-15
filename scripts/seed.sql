-- SQLite Database for LostFound
-- Can be opened directly in "DB Browser for SQLite", TablePlus, or DBeaver

DROP TABLE IF EXISTS claims;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE items (
    id TEXT PRIMARY KEY,
    type TEXT CHECK(type IN ('found', 'lost')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    images TEXT, -- JSON array of image URLs
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    status TEXT CHECK(status IN ('active', 'claimed', 'resolved')) DEFAULT 'active',
    user_id TEXT REFERENCES users(id),
    user_name TEXT,
    user_email TEXT,
    user_phone TEXT,
    reward REAL DEFAULT 0,
    verification_questions TEXT, -- JSON array of 3 secret questions
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE claims (
    id TEXT PRIMARY KEY,
    item_id TEXT REFERENCES items(id),
    item_title TEXT NOT NULL,
    claimant_id TEXT REFERENCES users(id),
    claimant_name TEXT NOT NULL,
    claimant_email TEXT NOT NULL,
    claimant_phone TEXT NOT NULL,
    proof_1 TEXT NOT NULL,
    proof_2 TEXT NOT NULL,
    proof_3 TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    finder_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Users
INSERT INTO users (id, name, email, phone, avatar) VALUES
('user-1', 'Elena Rostova', 'elena.rostova@example.com', '+1 (555) 987-6543', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200'),
('user-2', 'Sarah Jenkins', 'sarah.j@example.com', '+1 (555) 234-5678', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200'),
('user-3', 'Alex Wong', 'alex.w@example.com', '+1 (555) 345-6789', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'),
('user-4', 'Marcus Rivera', 'marcus.r@example.com', '+1 (555) 456-7890', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200');

-- Seed Initial Items
INSERT INTO items (id, type, title, description, category, images, lat, lng, address, city, occurred_at, status, user_id, user_name, user_email, user_phone, reward, verification_questions) VALUES
(
  'item-1',
  'found',
  'Found Apple iPhone 14 Pro in Black Case',
  'Found on a park bench near the central fountain. The phone has a matte black protective case with a distinctive kickstand. Screen was locked with 45% battery remaining.',
  'electronics',
  '["https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800","https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800"]',
  37.7749,
  -122.4194,
  'Civic Center Plaza, San Francisco, CA',
  'San Francisco',
  datetime('now', '-3 hours'),
  'active',
  'user-2',
  'Sarah Jenkins',
  'sarah.j@example.com',
  '+1 (555) 234-5678',
  0,
  '["What picture is set as the lock screen wallpaper?","What brand is the matte black phone case?","Are there any cards or stickers tucked into the phone case?"]'
),
(
  'item-2',
  'found',
  'Brown Leather Bifold Wallet',
  'Found under a dining table at Blue Bottle Coffee. Contains multiple membership cards and cash. Kept safe with the cafe manager.',
  'wallets',
  '["https://images.unsplash.com/photo-1627123424574-724758594e93?w=800","https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800"]',
  37.7858,
  -122.4065,
  '66 Mint St, San Francisco, CA 94103',
  'San Francisco',
  datetime('now', '-7 hours'),
  'active',
  'user-3',
  'Alex Wong',
  'alex.w@example.com',
  '+1 (555) 345-6789',
  0,
  '["What brand is stamped on the outer leather?","What initials or name appears on the transit card inside?","What color is the inner stitch threading?"]'
),
(
  'item-3',
  'found',
  'Set of 4 Keys with Car Key Fob & Blue Lanyard',
  'Found hanging on the fence near the dog park entrance. Has a Subaru fob, house keys, and a miniature swiss army knife.',
  'keys',
  '["https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800"]',
  37.7694,
  -122.4467,
  'Buena Vista Park, SF, CA',
  'San Francisco',
  datetime('now', '-14 hours'),
  'active',
  'user-4',
  'Marcus Rivera',
  'marcus.r@example.com',
  '+1 (555) 456-7890',
  0,
  '["What car model/year is the fob for?","What text is printed along the blue lanyard?","What color is the small swiss army knife attached?"]'
),
(
  'item-5',
  'lost',
  'LOST: Golden Retriever Mix "Charlie"',
  'Charlie slipped his collar near Mission Dolores Park yesterday evening. He is microchipped, very friendly, and responds to treats. $500 reward for safe return.',
  'pets',
  '["https://images.unsplash.com/photo-1552053831-71594a27632d?w=800"]',
  37.7596,
  -122.4269,
  'Dolores Park, San Francisco, CA',
  'San Francisco',
  datetime('now', '-18 hours'),
  'active',
  'user-1',
  'Elena Rostova',
  'elena.rostova@example.com',
  '+1 (555) 987-6543',
  500,
  '[]'
);

-- Seed Sample Claim
INSERT INTO claims (id, item_id, item_title, claimant_id, claimant_name, claimant_email, claimant_phone, proof_1, proof_2, proof_3, status) VALUES
(
  'claim-1',
  'item-2',
  'Brown Leather Bifold Wallet',
  'user-1',
  'Elena Rostova',
  'elena.rostova@example.com',
  '+1 (555) 987-6543',
  'Initials "ER" stamped on the inner left cash pocket',
  'A gym membership barcode card for Crunch Fitness ending in 4921',
  'A folded emergency silver key behind the card divider',
  'pending'
);
