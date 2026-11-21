// GET /api/admin/analytics?days=7|30|90 – first-party analytics for the admin Analytics page.
// Totals per event, a daily series, and the ads A/B comparison (ads vs no-ads holdout).
import { NextRequest, NextResponse } from 'next/server';
import { adminFail, adminRouteError, requireAdmin } from '@/lib/admin/server';
import { supabaseAdmin } from '@/lib/db';
import { readAdsSettingsFresh } from '@/lib/siteContent';
import { CLIENT_EVENTS, SERVER_EVENTS, type AnalyticsEvent } from '@/lib/monetization';

type Row = { day: string; name: string; ad_variant: string; events: number; visitors: number };
const ALL_EVENTS: AnalyticsEvent[] = [...CLIENT_EVENTS, ...SERVER_EVENTS];
const SERIES: AnalyticsEvent[] = ['page_view', 'item_view', 'item_posted', 'claim_made', 'ad_impression'];
const IST_OFFSET_MS = 5.5 * 3600_000;

/** Calendar day in India for a moment in time, YYYY-MM-DD. */
const istDay = (ms: number) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'analytics.view');
  if (auth.response) return auth.response;
  try {
    const asked = Number(req.nextUrl.searchParams.get('days'));
    const days = [7, 30, 90].includes(asked) ? asked : 30;
    const firstDay = istDay(Date.now() - (days - 1) * 86400_000);
    // Midnight IST at the start of the first day.
    const since = new Date(Date.parse(`${firstDay}T00:00:00Z`) - IST_OFFSET_MS);

    const { data, error } = await supabaseAdmin.rpc('analytics_daily', { since: since.toISOString() });
    if (error) {
      if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code)) {
        return adminFail(503, 'Analytics needs the database update: run supabase/migrations/10_analytics.sql in the Supabase SQL editor.', { code: 'MIGRATION_REQUIRED' });
      }
      throw error;
    }
    const rows: Row[] = ((data ?? []) as any[]).map((r) => ({
      day: String(r.day).slice(0, 10),
      name: String(r.name),
      ad_variant: String(r.ad_variant),
      events: Number(r.events),
      visitors: Number(r.visitors),
    }));
    const sum = (pred: (r: Row) => boolean, key: 'events' | 'visitors' = 'events') => rows.filter(pred).reduce((s, r) => s + r[key], 0);

    const totals = Object.fromEntries(ALL_EVENTS.map((e) => [e, sum((r) => r.name === e)])) as Record<AnalyticsEvent, number>;
    // Summed daily unique visitors (someone seen on 3 days counts 3 times).
    const visitorDays = sum((r) => r.name === 'page_view', 'visitors');

    const perDay = Array.from({ length: days }, (_, i) => {
      const day = istDay(Date.now() - (days - 1 - i) * 86400_000);
      const out: Record<string, number | string> = { day };
      for (const e of SERIES) out[e] = sum((r) => r.day === day && r.name === e);
      return out;
    });

    const group = (variant: 'ads' | 'holdout') => {
      const n = (name: AnalyticsEvent) => sum((r) => r.ad_variant === variant && r.name === name);
      const pageViews = n('page_view');
      const itemViews = n('item_view');
      const claimStarted = n('claim_started');
      const claimsMade = n('claim_made');
      return {
        visitorDays: sum((r) => r.ad_variant === variant && r.name === 'page_view', 'visitors'),
        pageViews,
        itemViews,
        claimStarted,
        claimsMade,
        adImpressions: n('ad_impression'),
        /** Claim forms opened per 100 item views. */
        claimStartRate: itemViews ? (claimStarted / itemViews) * 100 : null,
        /** Claims submitted per 1,000 page views. */
        claimsPer1000Views: pageViews ? (claimsMade / pageViews) * 1000 : null,
      };
    };
    const ads = group('ads');
    const holdout = group('holdout');
    // Rough guide: under ~300 item views in the smaller group, a difference is mostly noise.
    const enoughData = Math.min(ads.itemViews, holdout.itemViews) >= 300;

    const settings = await readAdsSettingsFresh().catch(() => null);
    return NextResponse.json({
      success: true,
      data: {
        days,
        since: since.toISOString(),
        totals,
        visitorDays,
        perDay,
        abTest: {
          ads,
          holdout,
          enoughData,
          holdoutPercent: settings?.effective.holdoutPercent ?? null,
          adsEnabled: !!(settings?.effective.enabled && settings.effective.client),
        },
        gaConfigured: !!settings?.effective.gaMeasurementId,
      },
    });
  } catch (e) {
    return adminRouteError(e, 'analytics GET');
  }
}
