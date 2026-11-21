// Ads + analytics settings shared by the server, the browser and the admin form.
// Keep this file free of server-only imports.
// -------------------------------------------------------------------
// Saved by a super admin at /admin/ads (site_settings key "ads"). The
// AdSense publisher id and the GA4 id fall back to env vars, so a deploy
// can also set them:
//   NEXT_PUBLIC_ADSENSE_CLIENT  – ca-pub-XXXXXXXXXXXXXXXX
//   NEXT_PUBLIC_GA_ID           – G-XXXXXXXXXX
// -------------------------------------------------------------------

export const AD_SLOT_KEYS = ['homeTop', 'homeInfeed', 'homeSplit', 'itemDetail'] as const;
export type AdSlotKey = (typeof AD_SLOT_KEYS)[number];

export const AD_SLOT_INFO: Record<AdSlotKey, { label: string; where: string; size: string }> = {
  homeTop: { label: 'Home – below filters', where: 'One banner between the filter bar and the results.', size: '728×90 desktop, 320×50 mobile (display ad unit)' },
  homeInfeed: { label: 'Home – in the grid', where: 'One card after every N items in grid view.', size: 'In-feed ad unit (needs its layout key)' },
  homeSplit: { label: 'Home – under the map', where: 'Below the map panel in split view (desktop).', size: '300×250 (display ad unit)' },
  itemDetail: { label: 'Item details', where: 'Bottom of an item’s details for people who did not post or claim it.', size: 'Responsive display ad unit' },
};

export interface AdsSettings {
  /** Master switch for ads on the website. */
  enabled: boolean;
  /** AdSense publisher id, ca-pub-… */
  client: string;
  /** Send data-adtest="on": test ads that don't earn or count (use before approval / on staging). */
  testMode: boolean;
  /** % of visitors who never see ads, to measure whether ads lower the claim rate. 0–50. */
  holdoutPercent: number;
  /** In grid view, an ad card after every N items. 4–30. */
  infeedEvery: number;
  /** In-feed ad unit's layout key from AdSense (data-ad-layout-key). */
  infeedLayoutKey: string;
  slots: Record<AdSlotKey, string>;
  /** Google Analytics 4 measurement id, G-… (optional – first-party analytics work without it). */
  gaMeasurementId: string;
}

export const DEFAULT_ADS_SETTINGS: AdsSettings = {
  enabled: false,
  client: '',
  testMode: true,
  holdoutPercent: 10,
  infeedEvery: 8,
  infeedLayoutKey: '',
  slots: { homeTop: '', homeInfeed: '', homeSplit: '', itemDetail: '' },
  gaMeasurementId: '',
};

const CLIENT_RE = /^ca-pub-\d{10,20}$/;
const SLOT_RE = /^\d{6,15}$/;
const GA_RE = /^G-[A-Z0-9]{4,15}$/;
const LAYOUT_RE = /^[-+a-z0-9]{4,40}$/i;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const int = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt;
};

/** Clean stored or submitted settings: unknown keys dropped, bad values reset. Never throws. */
export function sanitizeAdsSettings(raw: unknown): AdsSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const d = DEFAULT_ADS_SETTINGS;
  const slotsIn = (r.slots && typeof r.slots === 'object' ? r.slots : {}) as Record<string, unknown>;
  const slots = {} as Record<AdSlotKey, string>;
  for (const k of AD_SLOT_KEYS) slots[k] = SLOT_RE.test(str(slotsIn[k])) ? str(slotsIn[k]) : '';
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : d.enabled,
    client: CLIENT_RE.test(str(r.client)) ? str(r.client) : '',
    testMode: typeof r.testMode === 'boolean' ? r.testMode : d.testMode,
    holdoutPercent: int(r.holdoutPercent, 0, 50, d.holdoutPercent),
    infeedEvery: int(r.infeedEvery, 4, 30, d.infeedEvery),
    infeedLayoutKey: LAYOUT_RE.test(str(r.infeedLayoutKey)) ? str(r.infeedLayoutKey) : '',
    slots,
    gaMeasurementId: GA_RE.test(str(r.gaMeasurementId).toUpperCase()) ? str(r.gaMeasurementId).toUpperCase() : '',
  };
}

/** Problems with submitted settings, by field (empty = valid). Used by the admin API. */
export function adsSettingsProblems(raw: any): Record<string, string> {
  const p: Record<string, string> = {};
  const client = str(raw?.client);
  if (client && !CLIENT_RE.test(client)) p.client = 'Publisher id looks like ca-pub-1234567890123456.';
  if (raw?.enabled && !client && !process.env.NEXT_PUBLIC_ADSENSE_CLIENT) p.client = 'Add the publisher id before turning ads on.';
  for (const k of AD_SLOT_KEYS) {
    const v = str(raw?.slots?.[k]);
    if (v && !SLOT_RE.test(v)) p[`slots.${k}`] = 'Ad slot ids are numbers only, e.g. 1234567890.';
  }
  const lk = str(raw?.infeedLayoutKey);
  if (lk && !LAYOUT_RE.test(lk)) p.infeedLayoutKey = 'Layout key looks like -fb+5w+4e-db+86.';
  const ga = str(raw?.gaMeasurementId);
  if (ga && !GA_RE.test(ga.toUpperCase())) p.gaMeasurementId = 'Measurement id looks like G-ABC123XYZ9.';
  return p;
}

/** Settings with env fallbacks applied – what the site actually uses. */
export function effectiveAdsSettings(s: AdsSettings): AdsSettings {
  const envClient = str(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);
  const envGa = str(process.env.NEXT_PUBLIC_GA_ID).toUpperCase();
  return {
    ...s,
    client: s.client || (CLIENT_RE.test(envClient) ? envClient : ''),
    gaMeasurementId: s.gaMeasurementId || (GA_RE.test(envGa) ? envGa : ''),
  };
}

/** "ca-pub-123" → "pub-123" (the form ads.txt uses). */
export const publisherId = (client: string) => client.replace(/^ca-/, '');

// -------------------------------------------------------------------
// A/B holdout: each browser gets a random bucket 0–99 in the `lf_ab` cookie.
// Buckets below holdoutPercent never see ads.
// -------------------------------------------------------------------
export const AB_COOKIE = 'lf_ab';
export type AdVariant = 'ads' | 'holdout' | 'none';

export function parseBucket(v: string | undefined | null): number | null {
  if (v == null || !/^\d{1,2}$/.test(v)) return null;
  return Number(v);
}

/**
 * Which ads group a visitor is in.
 *  none    – ads are off / not set up, or the visitor didn't allow ad cookies
 *  holdout – would see ads but is in the no-ads test group
 *  ads     – sees ads
 */
export function adVariant(s: Pick<AdsSettings, 'enabled' | 'client' | 'holdoutPercent'>, bucket: number | null, adConsent: boolean): AdVariant {
  if (!s.enabled || !s.client || !adConsent) return 'none';
  if (bucket != null && bucket < s.holdoutPercent) return 'holdout';
  return 'ads';
}

// -------------------------------------------------------------------
// Analytics event names
// -------------------------------------------------------------------
/** Sent by the browser (only with analytics consent). */
export const CLIENT_EVENTS = ['page_view', 'item_view', 'claim_started', 'report_started', 'ad_impression'] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];
/** Written by the server when something happens. */
export const SERVER_EVENTS = ['item_posted', 'claim_made', 'claim_approved', 'post_approved', 'post_rejected'] as const;
export type ServerEvent = (typeof SERVER_EVENTS)[number];
export type AnalyticsEvent = ClientEvent | ServerEvent;

export const EVENT_LABEL: Record<AnalyticsEvent, string> = {
  page_view: 'Page views',
  item_view: 'Item views',
  claim_started: 'Claim forms opened',
  report_started: 'Report forms opened',
  ad_impression: 'Ad impressions',
  item_posted: 'Items posted',
  claim_made: 'Claims made',
  claim_approved: 'Claims approved',
  post_approved: 'Posts approved',
  post_rejected: 'Posts rejected',
};
