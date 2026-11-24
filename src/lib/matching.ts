// Saved searches and match alerts (server only). Phase 3 of the monetization plan.
// -------------------------------------------------------------------
// A saved search describes something a person lost. When a found item goes
// live (approved by a checker), it is scored against every active saved search
// whose area covers it:
//   category  – must match (when the search has one)
//   distance  – must be inside the search radius; closer scores higher
//   keywords  – at least one must appear in the item's title/description
//   dates     – found on/after the day it was lost scores higher
// Premium: alerted at once (in-app + push + email). Free: in a daily digest.
// AI photo matching (plan: image embeddings + pgvector) is not built yet.
// -------------------------------------------------------------------
import crypto from 'crypto';
import { isPublicItem, mapItemRow, supabaseAdmin } from '@/lib/db';
import { calculateDistanceKm } from '@/lib/geo';
import { getPlans } from '@/lib/billing';
import { createNotifications, deliverDue, getPrefsMany, quietEndsAt, type Channel, type NewNotification } from '@/lib/notify';
import type { Category, Item, MatchSummary, SavedSearch } from '@/types';
import type { Lang } from '@/i18n/config';

export const MATCH_THRESHOLD = 0.35;

export function mapSearchRow(r: any, matchCount?: number): SavedSearch {
  return {
    id: String(r.id),
    label: String(r.label),
    category: (r.category as Category) || null,
    keywords: String(r.keywords ?? ''),
    location: { lat: Number(r.lat), lng: Number(r.lng), address: String(r.address ?? '') },
    radiusKm: Number(r.radius_km),
    lostOn: r.lost_on ? String(r.lost_on).slice(0, 10) : null,
    active: r.active !== false,
    createdAt: String(r.created_at),
    matchCount,
  };
}

const STOP = new Set(['the', 'and', 'with', 'for', 'near', 'from', 'lost', 'found', 'my', 'a', 'an', 'of', 'in', 'on', 'at', 'is', 'it', 'was', 'mera', 'meri', 'mere', 'ka', 'ki', 'ke', 'hai', 'tha', 'thi', 'मेरा', 'मेरी', 'मेरे', 'का', 'की', 'के', 'है', 'था', 'थी', 'में', 'पर', 'से', 'और', 'खोया', 'मिला']);
export function tokens(text: string): string[] {
  return Array.from(new Set(String(text).toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w))));
}

export function scoreMatch(s: SavedSearch, item: Item): { score: number; distanceKm: number } | null {
  if (item.type !== 'found') return null;
  if (s.category && s.category !== item.category) return null;
  const distanceKm = calculateDistanceKm(s.location.lat, s.location.lng, item.location.lat, item.location.lng);
  if (distanceKm > s.radiusKm) return null;

  const kws = tokens(s.keywords);
  let kwScore = 0.5; // no keywords given: neutral
  if (kws.length) {
    const hay = new Set(tokens(`${item.title} ${item.description}`));
    // Also accept a keyword that is the start of a longer word ("iphone" ~ "iphone15").
    const hits = kws.filter((k) => hay.has(k) || Array.from(hay).some((h) => h.startsWith(k) || k.startsWith(h))).length;
    if (!hits) return null;
    kwScore = hits / kws.length;
  }

  let dateScore = 0.5;
  if (s.lostOn) {
    const days = (Date.parse(item.occurredAt) - Date.parse(`${s.lostOn}T00:00:00+05:30`)) / 86400_000;
    if (days < -1) return null; // found before it was lost
    dateScore = days <= 7 ? 1 : days <= 30 ? 0.6 : 0.3;
  }
  const distScore = 1 - distanceKm / Math.max(1, s.radiusKm);
  const score = Math.round((0.5 * kwScore + 0.3 * distScore + 0.2 * dateScore) * 100) / 100;
  return score >= MATCH_THRESHOLD ? { score, distanceKm } : null;
}

const MATCH_TEXT: Record<Lang, { title: (t: string) => string; body: (label: string, km: string, address: string) => string; digestTitle: (n: number) => string; digestBody: (lines: string) => string }> = {
  en: {
    title: (t) => `Possible match: ${t}`,
    body: (label, km, address) => `For your alert “${label}” · ${km} km away · ${address}\nIs this yours? Open it and claim it.`,
    digestTitle: (n) => (n === 1 ? '1 new possible match for your lost item' : `${n} new possible matches for your lost items`),
    digestBody: (lines) => `${lines}\n\nOpen LostFound to check them. Premium sends these the moment they are posted.`,
  },
  hi: {
    title: (t) => `संभावित मिलान: ${t}`,
    body: (label, km, address) => `आपके अलर्ट “${label}” के लिए · ${km} किमी दूर · ${address}\nक्या यह आपका है? खोलें और दावा करें।`,
    digestTitle: (n) => `आपकी खोई वस्तुओं के लिए ${n} नए संभावित मिलान`,
    digestBody: (lines) => `${lines}\n\nजाँचने के लिए LostFound खोलें। प्रीमियम में ये पोस्ट होते ही भेजे जाते हैं।`,
  },
};

/**
 * Match a found item that just went live against all saved searches.
 * Premium owners are alerted now; free owners' matches wait for the digest.
 * Never throws. Returns the number of matches created.
 */
export async function matchNewItem(itemId: string): Promise<number> {
  try {
    const { data: row } = await supabaseAdmin.from('items').select('*').eq('id', itemId).maybeSingle();
    if (!row) return 0;
    const item = mapItemRow(row);
    if (item.type !== 'found' || !isPublicItem(item) || item.status !== 'active') return 0;

    // Searches whose centre is within the largest radius (50 km) of the item.
    const R = 50;
    const dLat = R / 111;
    const dLng = R / (111 * Math.max(0.1, Math.cos((item.location.lat * Math.PI) / 180)));
    const { data: rows, error } = await supabaseAdmin
      .from('saved_searches')
      .select('*')
      .eq('active', true)
      .neq('user_id', item.userId)
      .gte('lat', item.location.lat - dLat)
      .lte('lat', item.location.lat + dLat)
      .gte('lng', item.location.lng - dLng)
      .lte('lng', item.location.lng + dLng)
      .limit(5000);
    if (error) throw error;

    const hits: { s: SavedSearch; userId: string; score: number; distanceKm: number }[] = [];
    for (const r of rows ?? []) {
      const s = mapSearchRow(r);
      const m = scoreMatch(s, item);
      if (m) hits.push({ s, userId: String(r.user_id), ...m });
    }
    if (!hits.length) return 0;

    const userIds = Array.from(new Set(hits.map((h) => h.userId)));
    const [plans, prefs] = await Promise.all([getPlans(userIds), getPrefsMany(userIds)]);
    const now = new Date().toISOString();
    const matchRows = hits.map((h) => ({
      id: crypto.randomUUID(),
      saved_search_id: h.s.id,
      item_id: item.id,
      user_id: h.userId,
      score: h.score,
      instant: plans.get(h.userId) === 'premium',
      notified_at: null as string | null,
    }));
    const { data: inserted, error: mErr } = await supabaseAdmin
      .from('matches')
      .upsert(matchRows, { onConflict: 'saved_search_id,item_id', ignoreDuplicates: true })
      .select('id, user_id, saved_search_id, instant');
    if (mErr) throw mErr;

    // Premium: one alert per person (even if several of their searches matched).
    const alerts: NewNotification[] = [];
    const alertedMatchIds: string[] = [];
    const seen = new Set<string>();
    for (const m of inserted ?? []) {
      if (!m.instant) continue;
      alertedMatchIds.push(m.id);
      if (seen.has(m.user_id)) continue;
      seen.add(m.user_id);
      const h = hits.find((x) => x.userId === m.user_id && x.s.id === m.saved_search_id)!;
      const p = prefs.get(m.user_id)!;
      const tx = MATCH_TEXT[p.lang];
      const channels: Channel[] = [...(p.matchPush ? (['push'] as const) : []), ...(p.matchEmail ? (['email'] as const) : [])];
      alerts.push({
        userId: m.user_id,
        kind: 'match',
        title: tx.title(item.title),
        body: tx.body(h.s.label, h.distanceKm < 1 ? '<1' : h.distanceKm.toFixed(1), item.location.city || item.location.address),
        url: `/?item=${encodeURIComponent(item.id)}&src=match`,
        itemId: item.id,
        priority: 1,
        channels,
        deliverAfter: quietEndsAt(p),
      });
    }
    if (alerts.length) {
      const ids = await createNotifications(alerts);
      await supabaseAdmin.from('matches').update({ notified_at: now }).in('id', alertedMatchIds);
      await deliverDue({ ids });
    }
    return (inserted ?? []).length;
  } catch (e: any) {
    if (e?.code !== 'PGRST205' && e?.code !== '42P01') console.error('[matching] failed', e?.message ?? e);
    return 0;
  }
}

/**
 * When someone saves a search, check what was already posted in the last 30 days
 * so they see candidates straight away (no alerts are sent for these).
 */
export async function backfillMatches(searchRow: any): Promise<number> {
  const s = mapSearchRow(searchRow);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await supabaseAdmin
    .from('items')
    .select('*')
    .eq('type', 'found')
    .eq('status', 'active')
    .eq('is_hidden', false)
    .eq('review_status', 'approved')
    .neq('user_id', searchRow.user_id)
    .gte('created_at', since)
    .limit(1000);
  const rows = (data ?? [])
    .map(mapItemRow)
    .map((item) => ({ item, m: scoreMatch(s, item) }))
    .filter((x) => x.m)
    .map((x) => ({
      id: crypto.randomUUID(),
      saved_search_id: s.id,
      item_id: x.item.id,
      user_id: searchRow.user_id,
      score: x.m!.score,
      instant: false,
      notified_at: new Date().toISOString(),
    }));
  if (!rows.length) return 0;
  await supabaseAdmin.from('matches').upsert(rows, { onConflict: 'saved_search_id,item_id', ignoreDuplicates: true });
  return rows.length;
}

/** Matches for the user's searches, newest first, with item summaries. */
export async function listMatches(userId: string, limit = 50): Promise<MatchSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('matches')
    .select('id, saved_search_id, score, created_at, item_id, saved_searches!matches_saved_search_id_fkey(lat, lng), items!matches_item_id_fkey(id, title, category, images, occurred_at, status, address, lat, lng, is_hidden, review_status)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? [])
    .filter((m: any) => m.items && !m.items.is_hidden && (m.items.review_status ?? 'approved') === 'approved')
    .map((m: any) => {
      const it = m.items;
      const images = Array.isArray(it.images) ? it.images : (() => { try { return JSON.parse(it.images ?? '[]'); } catch { return []; } })();
      return {
        id: String(m.id),
        savedSearchId: String(m.saved_search_id),
        score: Number(m.score),
        createdAt: String(m.created_at),
        item: {
          id: String(it.id),
          title: String(it.title),
          category: it.category,
          images,
          occurredAt: String(it.occurred_at),
          status: it.status,
          address: String(it.address ?? ''),
          distanceKm: m.saved_searches ? calculateDistanceKm(Number(m.saved_searches.lat), Number(m.saved_searches.lng), Number(it.lat), Number(it.lng)) : 0,
        },
      };
    });
}

/** Free users' daily digest: one notification (+ email) per person with their new matches. */
export async function runDigest(): Promise<{ users: number; matches: number }> {
  const { data, error } = await supabaseAdmin
    .from('matches')
    .select('id, user_id, items!matches_item_id_fkey(title, address, city, status, is_hidden, review_status)')
    .is('notified_at', null)
    .eq('instant', false)
    .limit(5000);
  if (error) throw error;
  const byUser = new Map<string, { ids: string[]; lines: string[] }>();
  for (const m of data ?? []) {
    const it: any = (m as any).items;
    const entry = byUser.get(m.user_id) ?? { ids: [], lines: [] };
    entry.ids.push(m.id);
    if (it && it.status === 'active' && !it.is_hidden && (it.review_status ?? 'approved') === 'approved' && entry.lines.length < 10) {
      entry.lines.push(`• ${it.title} – ${it.city || it.address}`);
    }
    byUser.set(m.user_id, entry);
  }
  const userIds = Array.from(byUser.keys());
  const prefs = await getPrefsMany(userIds);
  const list: NewNotification[] = [];
  for (const [userId, e] of byUser) {
    if (!e.lines.length) continue;
    const p = prefs.get(userId)!;
    const tx = MATCH_TEXT[p.lang];
    list.push({
      userId,
      kind: 'match_digest',
      title: tx.digestTitle(e.lines.length),
      body: tx.digestBody(e.lines.join('\n')),
      url: '/alerts',
      channels: p.matchEmail ? ['email'] : [],
    });
  }
  const ids = await createNotifications(list);
  const all = Array.from(byUser.values()).flatMap((e) => e.ids);
  for (let i = 0; i < all.length; i += 500) {
    await supabaseAdmin.from('matches').update({ notified_at: new Date().toISOString() }).in('id', all.slice(i, i + 500));
  }
  if (ids.length) await deliverDue({ ids });
  return { users: list.length, matches: all.length };
}
