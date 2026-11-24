// Notifications (server only): one notify() for in-app + push + email,
// with per-user preferences, quiet hours and a delivery queue.
// -------------------------------------------------------------------
// Every notification is a row in `notifications` (the in-app inbox, shown
// at once). Push and email go out from the same row: right away, or – during
// the user's quiet hours – at the end of them. deliverDue() sends whatever is
// due; it runs after each notify() and from the jobs runner (src/lib/jobs.ts).
// -------------------------------------------------------------------
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/db';
import { escapeHtml, sendEmail } from '@/lib/email';
import { sendPush } from '@/lib/webpush';
import { siteConfig } from '@/lib/siteConfig';
import type { Lang } from '@/i18n/config';

export type NotificationKind = 'boost_alert' | 'match' | 'match_digest' | 'boost_update';
export type Channel = 'push' | 'email';

export interface NotificationPrefs {
  nearbyAlerts: boolean;
  nearbyDailyLimit: 1 | 2;
  area: { lat: number; lng: number; label: string; updatedAt: string } | null;
  matchEmail: boolean;
  matchPush: boolean;
  quietStart: number;
  quietEnd: number;
  lang: Lang;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  nearbyAlerts: true,
  nearbyDailyLimit: 1,
  area: null,
  matchEmail: true,
  matchPush: true,
  quietStart: 22,
  quietEnd: 8,
  lang: 'en',
};

export function mapPrefsRow(r: any): NotificationPrefs {
  if (!r) return { ...DEFAULT_PREFS };
  return {
    nearbyAlerts: r.nearby_alerts !== false,
    nearbyDailyLimit: Number(r.nearby_daily_limit) === 2 ? 2 : 1,
    area: r.area_lat != null && r.area_lng != null ? { lat: Number(r.area_lat), lng: Number(r.area_lng), label: String(r.area_label ?? ''), updatedAt: String(r.area_updated_at ?? '') } : null,
    matchEmail: r.match_email !== false,
    matchPush: r.match_push !== false,
    quietStart: Number.isInteger(r.quiet_start) ? r.quiet_start : 22,
    quietEnd: Number.isInteger(r.quiet_end) ? r.quiet_end : 8,
    lang: r.lang === 'hi' ? 'hi' : 'en',
  };
}

export async function getPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabaseAdmin.from('notification_prefs').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return mapPrefsRow(data);
}

export async function getPrefsMany(userIds: string[]): Promise<Map<string, NotificationPrefs>> {
  const out = new Map<string, NotificationPrefs>();
  if (!userIds.length) return out;
  const { data } = await supabaseAdmin.from('notification_prefs').select('*').in('user_id', userIds);
  for (const id of userIds) out.set(id, { ...DEFAULT_PREFS });
  for (const r of data ?? []) out.set(String(r.user_id), mapPrefsRow(r));
  return out;
}

/** ~1 km precision: we never store an exact position. */
export const roundCoord = (v: number) => Math.round(v * 100) / 100;

export async function savePrefs(userId: string, patch: Partial<Omit<NotificationPrefs, 'area'>> & { area?: { lat: number; lng: number; label: string } | null }): Promise<NotificationPrefs> {
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (patch.nearbyAlerts !== undefined) row.nearby_alerts = patch.nearbyAlerts;
  if (patch.nearbyDailyLimit !== undefined) row.nearby_daily_limit = patch.nearbyDailyLimit;
  if (patch.matchEmail !== undefined) row.match_email = patch.matchEmail;
  if (patch.matchPush !== undefined) row.match_push = patch.matchPush;
  if (patch.quietStart !== undefined) row.quiet_start = patch.quietStart;
  if (patch.quietEnd !== undefined) row.quiet_end = patch.quietEnd;
  if (patch.lang !== undefined) row.lang = patch.lang;
  if (patch.area !== undefined) {
    row.area_lat = patch.area ? roundCoord(patch.area.lat) : null;
    row.area_lng = patch.area ? roundCoord(patch.area.lng) : null;
    row.area_label = patch.area ? patch.area.label.slice(0, 200) : null;
    row.area_updated_at = patch.area ? new Date().toISOString() : null;
  }
  const { error } = await supabaseAdmin.from('notification_prefs').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
  return getPrefs(userId);
}

// -------------------------------------------------------------------
// Time: users are in India, so quiet hours and "per day" use IST.
// -------------------------------------------------------------------
const IST_MS = 5.5 * 3600_000;
export const istHour = (ms = Date.now()) => new Date(ms + IST_MS).getUTCHours();
/** Midnight IST of the current day, as a Date. */
export function istDayStart(ms = Date.now()): Date {
  const d = new Date(ms + IST_MS);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - IST_MS);
}

export function inQuietHours(p: Pick<NotificationPrefs, 'quietStart' | 'quietEnd'>, ms = Date.now()): boolean {
  if (p.quietStart === p.quietEnd) return false;
  const h = istHour(ms);
  return p.quietStart < p.quietEnd ? h >= p.quietStart && h < p.quietEnd : h >= p.quietStart || h < p.quietEnd;
}

/** When the current quiet period ends (or now, if not in quiet hours). */
export function quietEndsAt(p: Pick<NotificationPrefs, 'quietStart' | 'quietEnd'>, ms = Date.now()): Date {
  if (!inQuietHours(p, ms)) return new Date(ms);
  const start = istDayStart(ms).getTime();
  let end = start + p.quietEnd * 3600_000;
  if (end <= ms) end += 24 * 3600_000;
  return new Date(end);
}

// -------------------------------------------------------------------
// One-tap "Stop nearby alerts" links (no sign-in needed).
// -------------------------------------------------------------------
const stopSecret = () => `${process.env.JWT_SECRET || 'dev-secret'}::lostfound-stop-alerts`;
export type StopKind = 'nearby' | 'match_email';

export function stopToken(userId: string, kind: StopKind): string {
  const body = Buffer.from(JSON.stringify({ u: userId, k: kind })).toString('base64url');
  const sig = crypto.createHmac('sha256', stopSecret()).update(body).digest('base64url').slice(0, 32);
  return `${body}.${sig}`;
}

export function verifyStopToken(token: string): { userId: string; kind: StopKind } | null {
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', stopSecret()).update(body).digest('base64url').slice(0, 32);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p?.u && (p.k === 'nearby' || p.k === 'match_email') ? { userId: String(p.u), kind: p.k } : null;
  } catch {
    return null;
  }
}

export const stopUrl = (userId: string, kind: StopKind) => `${siteConfig.url}/api/notifications/stop?t=${encodeURIComponent(stopToken(userId, kind))}`;

// -------------------------------------------------------------------
// Creating and delivering
// -------------------------------------------------------------------
export interface NewNotification {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Site path, e.g. /?item=123 */
  url?: string;
  itemId?: string;
  boostId?: string;
  priority?: number;
  channels: Channel[];
  /** Defaults to now. */
  deliverAfter?: Date;
}

/** Insert notifications. Returns their ids. Throws on database errors. */
export async function createNotifications(list: NewNotification[]): Promise<string[]> {
  if (!list.length) return [];
  const rows = list.map((n) => ({
    id: crypto.randomUUID(),
    user_id: n.userId,
    kind: n.kind,
    title: n.title.slice(0, 200),
    body: n.body.slice(0, 1000),
    url: n.url ?? null,
    item_id: n.itemId ?? null,
    boost_id: n.boostId ?? null,
    priority: n.priority ?? 0,
    channels: n.channels,
    deliver_after: (n.deliverAfter ?? new Date()).toISOString(),
    // Nothing to send outside the app → delivered already.
    delivered_at: n.channels.length ? null : new Date().toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabaseAdmin.from('notifications').insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
  return rows.map((r) => r.id);
}

const STOP_TEXT: Record<Lang, { nearby: string; match_email: string; open: string }> = {
  en: { nearby: 'Stop nearby alerts', match_email: 'Stop match emails', open: 'Open on LostFound' },
  hi: { nearby: 'आस-पास के अलर्ट बंद करें', match_email: 'मिलान ईमेल बंद करें', open: 'LostFound पर खोलें' },
};

function emailFor(n: any, lang: Lang) {
  const url = `${siteConfig.url}${n.url || '/'}`;
  const stopKind: StopKind | null = n.kind === 'boost_alert' ? 'nearby' : n.kind === 'match' || n.kind === 'match_digest' ? 'match_email' : null;
  const stop = stopKind ? stopUrl(n.user_id, stopKind) : null;
  const s = STOP_TEXT[lang];
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.6;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(siteConfig.name)}</h1>
<p style="font-size:16px;font-weight:bold;margin:0 0 8px">${escapeHtml(n.title)}</p>
<p style="white-space:pre-line">${escapeHtml(n.body)}</p>
<p style="margin:24px 0"><a href="${url}" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${s.open}</a></p>
${stop ? `<p style="font-size:12px;color:#64748b"><a href="${stop}" style="color:#64748b">${stopKind ? s[stopKind] : ''}</a></p>` : ''}
</body></html>`;
  const text = `${n.title}\n\n${n.body}\n\n${s.open}: ${url}${stop ? `\n\n${stopKind ? s[stopKind] : ''}: ${stop}` : ''}`;
  return { subject: n.title, html, text };
}

/**
 * Send push / email for notifications that are due (deliver_after <= now).
 * Pass ids to send just those (when due). Never throws; returns counts.
 */
export async function deliverDue(opts: { ids?: string[]; limit?: number } = {}): Promise<{ delivered: number; push: number; email: number }> {
  const stats = { delivered: 0, push: 0, email: 0 };
  try {
    let q = supabaseAdmin
      .from('notifications')
      .select('*')
      .is('delivered_at', null)
      .lte('deliver_after', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('deliver_after', { ascending: true })
      .limit(opts.limit ?? 200);
    if (opts.ids?.length) q = q.in('id', opts.ids);
    const { data: due, error } = await q;
    if (error) throw error;
    if (!due?.length) return stats;

    // Claim the rows first so two runners don't send the same alert twice.
    const ids = due.map((n: any) => n.id);
    const { data: claimed } = await supabaseAdmin.from('notifications').update({ delivered_at: new Date().toISOString() }).in('id', ids).is('delivered_at', null).select('id');
    const mine = new Set((claimed ?? []).map((r: any) => r.id));
    const rows = due.filter((n: any) => mine.has(n.id));
    if (!rows.length) return stats;

    const userIds = Array.from(new Set(rows.map((n: any) => String(n.user_id))));
    const [{ data: subs }, { data: users }, prefs] = await Promise.all([
      supabaseAdmin.from('push_subscriptions').select('*').in('user_id', userIds),
      supabaseAdmin.from('users').select('id, email').in('id', userIds),
      getPrefsMany(userIds),
    ]);
    const subsBy = new Map<string, any[]>();
    for (const s of subs ?? []) subsBy.set(String(s.user_id), [...(subsBy.get(String(s.user_id)) ?? []), s]);
    const emailBy = new Map((users ?? []).map((u: any) => [String(u.id), u.email ? String(u.email) : null]));

    for (const n of rows) {
      const result: Record<string, unknown> = {};
      const lang = prefs.get(String(n.user_id))?.lang ?? 'en';
      if (n.channels?.includes('push')) {
        let sent = 0;
        for (const s of subsBy.get(String(n.user_id)) ?? []) {
          const r = await sendPush(
            { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
            {
              title: n.title,
              body: n.body,
              url: n.url || '/',
              tag: n.item_id ? `item-${n.item_id}` : n.id,
              stop: n.kind === 'boost_alert' ? { label: STOP_TEXT[lang].nearby, url: stopUrl(n.user_id, 'nearby') } : undefined,
            },
            { urgency: n.priority > 0 ? 'high' : 'normal' }
          );
          if (r.ok) {
            sent++;
            await supabaseAdmin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id);
          } else if (r.gone) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', s.id);
          }
        }
        result.push = sent;
        stats.push += sent;
      }
      if (n.channels?.includes('email')) {
        const to = emailBy.get(String(n.user_id));
        if (to) {
          const r = await sendEmail({ to, ...emailFor(n, lang) });
          result.email = r.sent ? 'sent' : r.reason;
          if (r.sent) stats.email++;
        } else result.email = 'no_address';
      }
      await supabaseAdmin.from('notifications').update({ delivery: result }).eq('id', n.id);
      stats.delivered++;
    }
  } catch (e: any) {
    if (e?.code !== 'PGRST205' && e?.code !== '42P01') console.error('[notify] deliver failed', e?.message ?? e);
  }
  return stats;
}
