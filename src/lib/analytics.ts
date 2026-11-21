// First-party analytics (server only). Writes to analytics_events (migration 10).
// Recording must never break the request that triggered it: every error is
// logged and swallowed, and a missing table only logs once.
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { getAdsSettings } from '@/lib/siteContent';
import { CONSENT_COOKIE } from '@/lib/consent';
import { AB_COOKIE, adVariant, parseBucket, type AdVariant, type AnalyticsEvent } from '@/lib/monetization';

let warnedMissing = false;

export interface EventInput {
  userId?: string | null;
  visitorId?: string | null;
  variant?: AdVariant | null;
  path?: string | null;
  props?: Record<string, string | number | boolean | null>;
}

/** The ads A/B group of the visitor making this request (from the lf_ab and lf_consent cookies). */
export async function variantFor(req: NextRequest): Promise<AdVariant> {
  try {
    const { effective } = await getAdsSettings();
    let adConsent = false;
    const raw = req.cookies.get(CONSENT_COOKIE)?.value;
    if (raw) {
      try {
        adConsent = !!JSON.parse(decodeURIComponent(raw))?.ads;
      } catch {}
    }
    return adVariant(effective, parseBucket(req.cookies.get(AB_COOKIE)?.value), adConsent);
  } catch {
    return 'none';
  }
}

export async function recordEvents(rows: ({ name: AnalyticsEvent } & EventInput)[]): Promise<void> {
  if (!rows.length) return;
  try {
    const { error } = await supabaseAdmin.from('analytics_events').insert(
      rows.map((r) => ({
        name: r.name,
        user_id: r.userId ?? null,
        visitor_id: r.visitorId ?? null,
        ad_variant: r.variant ?? null,
        path: r.path ? r.path.slice(0, 300) : null,
        props: r.props ?? {},
      }))
    );
    if (error) throw error;
  } catch (e: any) {
    if (e?.code === 'PGRST205' || e?.code === '42P01') {
      if (!warnedMissing) console.warn('[analytics] analytics_events table missing – run supabase/migrations/10_analytics.sql');
      warnedMissing = true;
      return;
    }
    console.error('[analytics] record failed', e?.message ?? e);
  }
}

/** Record one business event for the request's user. Safe to call without awaiting the result. */
export async function recordServerEvent(req: NextRequest, name: AnalyticsEvent, input: EventInput = {}): Promise<void> {
  const variant = input.variant ?? (await variantFor(req));
  await recordEvents([{ name, ...input, variant }]);
}
