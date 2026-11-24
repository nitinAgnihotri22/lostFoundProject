-- 11_boosts_premium.sql – Phase 2 (boosts: alert everyone nearby) and Phase 3 (Premium: match alerts)
-- Run after 10_analytics.sql in the Supabase SQL editor. Safe to run twice.
--
-- Everything is free during launch. The payments / subscriptions tables are already
-- here so a payment provider can be added later without changing the data model:
-- free activations are recorded as payments with provider 'free_launch' and amount 0.

-- 1. Boost ranking on items ------------------------------------------------
ALTER TABLE items ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS items_boosted_until_idx ON items (boosted_until) WHERE boosted_until IS NOT NULL;

-- 2. Payments (every order, free or paid) ----------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  product       TEXT NOT NULL,                 -- e.g. boost_local, premium_monthly
  amount_paise  INTEGER NOT NULL DEFAULT 0,    -- list price at the time (0 charged while free)
  charged_paise INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'INR',
  provider      TEXT NOT NULL DEFAULT 'free_launch', -- later: razorpay / stripe
  provider_ref  TEXT,
  status        TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'created', 'paid', 'failed', 'refunded')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (user_id, created_at DESC);

-- 3. Subscriptions (Premium) ------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan                TEXT NOT NULL DEFAULT 'premium',
  billing_period      TEXT,                     -- monthly / quarterly / yearly (null while free)
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  source              TEXT NOT NULL DEFAULT 'free_launch',
  current_period_end  TIMESTAMPTZ,              -- null = no end (free launch)
  provider_ref        TEXT,
  payment_id          TEXT REFERENCES payments(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions (user_id, status);

-- 4. Boosts ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boosts (
  id                TEXT PRIMARY KEY,
  item_id           TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package           TEXT NOT NULL CHECK (package IN ('local', 'area', 'city')),
  radius_km         INTEGER NOT NULL,
  rounds_total      INTEGER NOT NULL,
  rounds_sent       INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending_review', 'active', 'completed', 'cancelled', 'rejected')),
  review_note       TEXT,
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ,
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  next_round_at     TIMESTAMPTZ,
  recipients_count  INTEGER NOT NULL DEFAULT 0,
  views_count       INTEGER NOT NULL DEFAULT 0,
  payment_id        TEXT REFERENCES payments(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS boosts_item_idx ON boosts (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS boosts_user_idx ON boosts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS boosts_due_idx ON boosts (next_round_at) WHERE status = 'active';

-- Who a boost already reached (one alert per person per boost).
CREATE TABLE IF NOT EXISTS boost_recipients (
  boost_id    TEXT NOT NULL REFERENCES boosts(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round       INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (boost_id, user_id)
);

-- 5. Notification preferences (incl. the user's area for nearby alerts) ------
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nearby_alerts       BOOLEAN NOT NULL DEFAULT TRUE,
  nearby_daily_limit  INTEGER NOT NULL DEFAULT 1 CHECK (nearby_daily_limit BETWEEN 1 AND 2),
  -- Last known area, rounded to ~1 km. Only stored after the user chooses it.
  area_lat            DOUBLE PRECISION,
  area_lng            DOUBLE PRECISION,
  area_label          TEXT,
  area_updated_at     TIMESTAMPTZ,
  match_email         BOOLEAN NOT NULL DEFAULT TRUE,
  match_push          BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_start         INTEGER NOT NULL DEFAULT 22 CHECK (quiet_start BETWEEN 0 AND 23),
  quiet_end           INTEGER NOT NULL DEFAULT 8 CHECK (quiet_end BETWEEN 0 AND 23),
  lang                TEXT NOT NULL DEFAULT 'en', -- language for push / email texts
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS notification_prefs_area_idx ON notification_prefs (area_lat, area_lng) WHERE nearby_alerts AND area_lat IS NOT NULL;

-- 6. Browser push subscriptions ----------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  platform      TEXT NOT NULL DEFAULT 'web',
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

-- 7. In-app notifications + delivery queue for push / email -----------------
CREATE TABLE IF NOT EXISTS notifications (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,            -- boost_alert, match, match_digest, boost_update
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  url            TEXT,
  item_id        TEXT REFERENCES items(id) ON DELETE CASCADE,
  boost_id       TEXT REFERENCES boosts(id) ON DELETE SET NULL,
  priority       INTEGER NOT NULL DEFAULT 0,
  channels       TEXT[] NOT NULL DEFAULT '{}', -- extra channels: push, email
  deliver_after  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at   TIMESTAMPTZ,
  delivery       JSONB,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_due_idx ON notifications (deliver_after) WHERE delivered_at IS NULL;

-- 8. Saved searches ("what I lost") and matches ------------------------------
CREATE TABLE IF NOT EXISTS saved_searches (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  category      TEXT,                       -- null = any category
  keywords      TEXT NOT NULL DEFAULT '',
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  address       TEXT NOT NULL DEFAULT '',
  radius_km     INTEGER NOT NULL DEFAULT 5,
  lost_on       DATE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS saved_searches_user_idx ON saved_searches (user_id);
CREATE INDEX IF NOT EXISTS saved_searches_active_idx ON saved_searches (active, lat, lng);

CREATE TABLE IF NOT EXISTS matches (
  id               TEXT PRIMARY KEY,
  saved_search_id  TEXT NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  item_id          TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score            REAL NOT NULL,
  instant          BOOLEAN NOT NULL DEFAULT FALSE, -- Premium: alerted at once; Free: in the daily digest
  notified_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (saved_search_id, item_id)
);
CREATE INDEX IF NOT EXISTS matches_pending_idx ON matches (user_id) WHERE notified_at IS NULL;

-- Only the server (service role) touches these tables.
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE boosts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE boost_recipients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_prefs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches             ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
