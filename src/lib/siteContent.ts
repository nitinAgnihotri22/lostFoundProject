// Editable site content (server only)
// -------------------------------------------------------------------
// Company/contact details (site_settings) and per-page text overrides
// (site_pages) saved from /admin/pages. When nothing is saved – or the
// migration hasn't been run – the built-in defaults are used, so the
// public pages always render.
// -------------------------------------------------------------------
import { cache } from 'react';
import { isMissingSchema, supabaseAdmin } from '@/lib/db';
import { siteConfig, type SiteConfig, type SiteSettings } from '@/lib/siteConfig';
import type { Lang } from '@/i18n/config';
import { DEFAULT_ADS_SETTINGS, effectiveAdsSettings, sanitizeAdsSettings, type AdsSettings } from '@/lib/monetization';

export const PAGE_SLUGS = ['privacy', 'terms', 'about', 'contact'] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];
export const isPageSlug = (v: unknown): v is PageSlug => PAGE_SLUGS.includes(v as PageSlug);

export interface PageOverride {
  slug: PageSlug;
  lang: Lang;
  title: string | null;
  body: string;
  updatedAt: string;
  updatedBy: string | null;
}

/**
 * Copy `patch` onto `base`, keeping only keys that exist in `base` and only
 * string values (trimmed, max 500 chars). Unknown keys and wrong types are dropped,
 * so stored JSON can never break the pages.
 */
export function mergeSettings<T>(base: T, patch: unknown): T {
  if (typeof base === 'string') {
    return (typeof patch === 'string' ? patch.trim().slice(0, 500) : base) as T;
  }
  if (base && typeof base === 'object' && patch && typeof patch === 'object' && !Array.isArray(patch)) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const key of Object.keys(out)) {
      if (key in (patch as Record<string, unknown>)) {
        out[key] = mergeSettings(out[key], (patch as Record<string, unknown>)[key]);
      }
    }
    return out as T;
  }
  return base;
}

/** The editable defaults (no name/url – those come from code and env). */
export function defaultSettings(): SiteSettings {
  const { name: _n, url: _u, ...rest } = siteConfig;
  return JSON.parse(JSON.stringify(rest));
}

// -------------------------------------------------------------------
// Caching: every public page reads these, so keep them off the hot path.
//  - results are kept in memory for 60s (per server instance);
//  - admin saves clear this instance's cache at once (other instances
//    catch up within 60s);
//  - a slow or unreachable database never blocks a page for more than 2s –
//    the built-in defaults are shown instead (and not cached).
// -------------------------------------------------------------------
const TTL_MS = 60_000;
const TIMEOUT_MS = 2_000;
const memo = new Map<string, { at: number; value: unknown }>();
const TIMED_OUT = Symbol('timeout');

async function cached<T>(key: string, load: () => Promise<T>, fallback: T): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      load(),
      new Promise<typeof TIMED_OUT>((resolve) => (timer = setTimeout(() => resolve(TIMED_OUT), TIMEOUT_MS))),
    ]);
    if (result === TIMED_OUT) return fallback;
    memo.set(key, { at: Date.now(), value: result });
    return result;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

/** Call after saving settings or page text so this server shows the change immediately. */
export function invalidateSiteContent(): void {
  memo.clear();
}

const isMissingTable = (e: any) => isMissingSchema(e) || e?.code === '42P01';

/** Read the saved settings straight from the database (no cache; errors throw). For the admin form. */
export async function readSiteConfigFresh(): Promise<ConfigResult> {
  const { data, error } = await supabaseAdmin.from('site_settings').select('value, updated_at').eq('key', 'site').maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_CONFIG;
  return {
    config: { ...mergeSettings(siteConfig, data.value), name: siteConfig.name, url: siteConfig.url },
    customized: true,
    updatedAt: String(data.updated_at),
  };
}

type ConfigResult = { config: SiteConfig; customized: boolean; updatedAt?: string };
const DEFAULT_CONFIG: ConfigResult = { config: siteConfig, customized: false };

/** Site config with any saved admin edits applied. */
export const getSiteConfig = cache(
  (): Promise<ConfigResult> =>
    cached<ConfigResult>(
      'settings',
      async () => {
        const { data, error } = await supabaseAdmin.from('site_settings').select('value, updated_at').eq('key', 'site').maybeSingle();
        // Table missing (migration 07 not run) → defaults, cached like a normal answer.
        // Any other error throws, so the defaults are shown but not cached.
        if (error && !isMissingTable(error)) throw error;
        if (!data) return DEFAULT_CONFIG;
        return {
          config: { ...mergeSettings(siteConfig, data.value), name: siteConfig.name, url: siteConfig.url },
          customized: true,
          updatedAt: String(data.updated_at),
        };
      },
      DEFAULT_CONFIG
    )
);

export const getPageOverride = cache(
  (slug: PageSlug, lang: Lang): Promise<PageOverride | null> =>
    cached<PageOverride | null>(
      `page:${slug}:${lang}`,
      async () => {
        const { data, error } = await supabaseAdmin.from('site_pages').select('*').eq('slug', slug).eq('lang', lang).maybeSingle();
        if (error && !isMissingTable(error)) throw error;
        return data ? mapPageRow(data) : null;
      },
      null
    )
);

export function mapPageRow(row: any): PageOverride {
  return {
    slug: row.slug,
    lang: row.lang,
    title: row.title ? String(row.title) : null,
    body: String(row.body ?? ''),
    updatedAt: String(row.updated_at),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
  };
}

/** YYYY-MM-DD for the "Last updated" line. */
export const isoDay = (iso: string) => iso.slice(0, 10);

// -------------------------------------------------------------------
// Ads + analytics settings (site_settings key "ads"), edited at /admin/ads.
// -------------------------------------------------------------------
export interface AdsSettingsResult {
  /** As saved (no env fallbacks) – for the admin form. */
  saved: AdsSettings;
  /** With env fallbacks – what the website uses. */
  effective: AdsSettings;
  updatedAt: string | null;
}

const toAdsResult = (value: unknown, updatedAt: string | null): AdsSettingsResult => {
  const saved = sanitizeAdsSettings(value);
  return { saved, effective: effectiveAdsSettings(saved), updatedAt };
};

/** Straight from the database (no cache; errors throw). For the admin form. */
export async function readAdsSettingsFresh(): Promise<AdsSettingsResult> {
  const { data, error } = await supabaseAdmin.from('site_settings').select('value, updated_at').eq('key', 'ads').maybeSingle();
  if (error) throw error;
  return toAdsResult(data?.value ?? DEFAULT_ADS_SETTINGS, data ? String(data.updated_at) : null);
}

/** Cached ads settings for the public site. Defaults (ads off) when nothing is saved or the DB is slow. */
export const getAdsSettings = cache(
  (): Promise<AdsSettingsResult> =>
    cached<AdsSettingsResult>(
      'ads',
      async () => {
        const { data, error } = await supabaseAdmin.from('site_settings').select('value, updated_at').eq('key', 'ads').maybeSingle();
        if (error && !isMissingTable(error)) throw error;
        return toAdsResult(data?.value ?? DEFAULT_ADS_SETTINGS, data ? String(data.updated_at) : null);
      },
      toAdsResult(DEFAULT_ADS_SETTINGS, null)
    )
);
