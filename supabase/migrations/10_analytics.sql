-- 10_analytics.sql – first-party analytics events (Phase 1 of the monetization plan)
-- Run after 09_phone_login.sql in the Supabase SQL editor. Safe to run twice.
--
-- Two kinds of rows:
--  * business events written by the server (item_posted, claim_made, claim_approved,
--    post_approved, post_rejected) – always recorded, no visitor id;
--  * browsing events sent by the browser (page_view, item_view, claim_started,
--    report_started, ad_impression) – only from visitors who allowed analytics
--    cookies; visitor_id is a random id kept in their browser, never their account.
-- ad_variant tags each row with the ads A/B group: 'ads', 'holdout' (no ads on
-- purpose) or 'none' (ads off, not configured, or no ad consent).

CREATE TABLE IF NOT EXISTS analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  user_id     TEXT,
  visitor_id  TEXT,
  ad_variant  TEXT,
  path        TEXT,
  props       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS analytics_events_name_time_idx ON analytics_events (name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_time_idx ON analytics_events (created_at DESC);

-- Only the server (service role) reads and writes this table.
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Daily counts per event and ads variant, for the admin Analytics page.
CREATE OR REPLACE FUNCTION analytics_daily(since TIMESTAMPTZ)
RETURNS TABLE (day DATE, name TEXT, ad_variant TEXT, events BIGINT, visitors BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
         name,
         COALESCE(ad_variant, 'none') AS ad_variant,
         COUNT(*) AS events,
         COUNT(DISTINCT visitor_id) AS visitors
  FROM analytics_events
  WHERE created_at >= since
  GROUP BY 1, 2, 3
$$;

REVOKE ALL ON FUNCTION analytics_daily(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
