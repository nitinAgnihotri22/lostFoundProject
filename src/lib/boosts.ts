// Boosts: pin an item to the top and alert people nearby (server only).
// Phase 2 of the monetization plan. Free during launch (see src/lib/plans.ts).
// -------------------------------------------------------------------
// Rules from the plan:
//  - only people who turned on "Nearby alerts" and set their area receive them;
//  - at most their daily limit (1 or 2) of boost alerts a day; pets and documents
//    may use the second slot even when the limit is 1;
//  - nothing pushed during quiet hours (default 10 pm – 8 am): queued until the end;
//  - one alert per person per boost; every alert has a one-tap "Stop nearby alerts";
//  - a person's first boost waits for a quick admin review; later ones start at once;
//  - no phone numbers, links or prices in a boosted item's text.
// -------------------------------------------------------------------
import crypto from 'crypto';
import { getItem, isPublicItem, supabaseAdmin } from '@/lib/db';
import { calculateDistanceKm } from '@/lib/geo';
import { getPlan, startOrder } from '@/lib/billing';
import { BOOST_PACKAGES, MAX_BOOST_ALERTS_PER_DAY, PRIORITY_CATEGORIES, type BoostPackage } from '@/lib/plans';
import { createNotifications, deliverDue, getPrefsMany, istDayStart, mapPrefsRow, quietEndsAt, type NewNotification, type NotificationPrefs } from '@/lib/notify';
import type { Boost, Item } from '@/types';
import type { Lang } from '@/i18n/config';

export class BoostError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

export function mapBoostRow(r: any, messagesCount?: number): Boost {
  return {
    id: String(r.id),
    itemId: String(r.item_id),
    package: r.package,
    radiusKm: Number(r.radius_km),
    status: r.status,
    reviewNote: r.review_note ?? undefined,
    startsAt: r.starts_at ?? undefined,
    endsAt: r.ends_at ?? undefined,
    roundsTotal: Number(r.rounds_total),
    roundsSent: Number(r.rounds_sent),
    nextRoundAt: r.next_round_at ?? undefined,
    recipientsCount: Number(r.recipients_count ?? 0),
    viewsCount: Number(r.views_count ?? 0),
    messagesCount,
    createdAt: String(r.created_at),
  };
}

// -------------------------------------------------------------------
// Text checks (abuse limits)
// -------------------------------------------------------------------
const PHONE_RE = /(?:\+?\d[\s-]?){9,}\d/;
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|net|org|io|co|me|link|xyz)\b)/i;
const PRICE_RE = /(₹\s*\d|\brs\.?\s*\d|\binr\s*\d|\d[\d,]*\s*(rs|rupees|inr)\b)/i;

/** Why an item's text can't be boosted, or null. */
export function boostTextProblem(item: Pick<Item, 'title' | 'description'>): { code: string; message: string } | null {
  const text = `${item.title}\n${item.description}`;
  if (PHONE_RE.test(text)) return { code: 'BOOST_TEXT_PHONE', message: 'Remove phone numbers from the title and description before boosting – people contact you through LostFound.' };
  if (LINK_RE.test(text)) return { code: 'BOOST_TEXT_LINK', message: 'Remove links from the title and description before boosting.' };
  if (PRICE_RE.test(text)) return { code: 'BOOST_TEXT_PRICE', message: 'Remove prices or reward amounts from the text before boosting.' };
  return null;
}

// -------------------------------------------------------------------
// Who is nearby
// -------------------------------------------------------------------
interface Candidate {
  userId: string;
  distanceKm: number;
  prefs: NotificationPrefs;
}

/** People with nearby alerts on whose area is within radiusKm of the point (excluding `excludeUserId`). */
async function nearbyPeople(lat: number, lng: number, radiusKm: number, excludeUserId: string): Promise<Candidate[]> {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  const out: Candidate[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('notification_prefs')
      .select('*')
      .eq('nearby_alerts', true)
      .gte('area_lat', lat - dLat)
      .lte('area_lat', lat + dLat)
      .gte('area_lng', lng - dLng)
      .lte('area_lng', lng + dLng)
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) {
      if (String(r.user_id) === excludeUserId) continue;
      const d = calculateDistanceKm(lat, lng, Number(r.area_lat), Number(r.area_lng));
      if (d <= radiusKm) {
        out.push({ userId: String(r.user_id), distanceKm: d, prefs: mapPrefsRow(r) });
      }
    }
    if ((data ?? []).length < 1000) break;
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Estimated reach for each package (people with nearby alerts in range). */
export async function estimateReach(item: Item): Promise<Record<BoostPackage, number>> {
  const all = await nearbyPeople(item.location.lat, item.location.lng, BOOST_PACKAGES.city.radiusKm, item.userId);
  return {
    local: all.filter((c) => c.distanceKm <= BOOST_PACKAGES.local.radiusKm).length,
    area: all.filter((c) => c.distanceKm <= BOOST_PACKAGES.area.radiusKm).length,
    city: all.length,
  };
}

// -------------------------------------------------------------------
// Reading
// -------------------------------------------------------------------
export async function boostsForItem(itemId: string): Promise<Boost[]> {
  const { data, error } = await supabaseAdmin.from('boosts').select('*').eq('item_id', itemId).order('created_at', { ascending: false }).limit(10);
  if (error) throw error;
  const rows = data ?? [];
  const live = rows.find((r: any) => r.starts_at);
  let messages = 0;
  if (live) {
    const { count } = await supabaseAdmin.from('conversations').select('id', { count: 'exact', head: true }).eq('item_id', itemId).gte('created_at', live.starts_at);
    messages = count ?? 0;
  }
  return rows.map((r: any) => mapBoostRow(r, r.starts_at ? messages : undefined));
}

/** Boosts the user started in the last 30 days (rejected/cancelled-before-start don't count). */
export async function boostsUsed(userId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { count, error } = await supabaseAdmin
    .from('boosts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)
    .in('status', ['pending_review', 'active', 'completed']);
  if (error) throw error;
  return count ?? 0;
}

/** Count a non-owner view of a boosted item (shown to the owner as results). */
export async function recordBoostView(itemId: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin.from('boosts').select('id, views_count').eq('item_id', itemId).eq('status', 'active').limit(1);
    const b = data?.[0];
    if (b) await supabaseAdmin.from('boosts').update({ views_count: Number(b.views_count) + 1 }).eq('id', b.id);
  } catch {}
}

// -------------------------------------------------------------------
// Creating, activating, cancelling
// -------------------------------------------------------------------
export async function createBoost(userId: string, itemId: string, pkg: BoostPackage): Promise<{ boost: Boost; needsReview: boolean }> {
  const info = BOOST_PACKAGES[pkg];
  if (!info) throw new BoostError('Choose a boost package.', 400, 'BAD_PACKAGE');
  const item = await getItem(itemId);
  if (!item || item.userId !== userId) throw new BoostError('You can only boost your own posts.', 403, 'NOT_ITEM_OWNER');
  if (!isPublicItem(item)) throw new BoostError('This post is not live yet. It can be boosted once it has been approved.', 409, 'ITEM_NOT_LIVE');
  if (item.status !== 'active') throw new BoostError('Only open posts can be boosted.', 409, 'ITEM_CLOSED');
  const text = boostTextProblem(item);
  if (text) throw new BoostError(text.message, 400, text.code);

  const { data: running } = await supabaseAdmin.from('boosts').select('id').eq('item_id', itemId).in('status', ['pending_review', 'active']).limit(1);
  if (running?.length) throw new BoostError('This post already has a boost running.', 409, 'ALREADY_BOOSTED');

  const { limits } = await getPlan(userId);
  if ((await boostsUsed(userId)) >= limits.boostsPer30Days) {
    throw new BoostError(`You can start up to ${limits.boostsPer30Days} boosts in 30 days.`, 429, 'BOOST_LIMIT');
  }

  // First boost from this account → quick manual review.
  const { count: previous } = await supabaseAdmin.from('boosts').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['active', 'completed']);
  const needsReview = !previous;

  const order = await startOrder(userId, info.product, info.pricePaise);
  const id = crypto.randomUUID();
  const { error } = await supabaseAdmin.from('boosts').insert({
    id,
    item_id: itemId,
    user_id: userId,
    package: pkg,
    radius_km: info.radiusKm,
    rounds_total: info.rounds,
    status: needsReview ? 'pending_review' : 'active',
    payment_id: order.paymentId,
  });
  if (error) throw error;
  if (!needsReview) await activateBoost(id);
  const { data } = await supabaseAdmin.from('boosts').select('*').eq('id', id).single();
  return { boost: mapBoostRow(data), needsReview };
}

/** Start a boost now: pin the item and schedule round 1 immediately. */
export async function activateBoost(boostId: string, reviewer?: { id: string }): Promise<void> {
  const { data: b, error } = await supabaseAdmin.from('boosts').select('*').eq('id', boostId).single();
  if (error) throw error;
  const info = BOOST_PACKAGES[b.package as BoostPackage];
  const start = new Date();
  const end = new Date(start.getTime() + info.durationHours * 3600_000);
  const { error: e2 } = await supabaseAdmin
    .from('boosts')
    .update({
      status: 'active',
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      next_round_at: start.toISOString(),
      ...(reviewer ? { reviewed_by: reviewer.id, reviewed_at: start.toISOString() } : {}),
    })
    .eq('id', boostId)
    .in('status', ['pending_review', 'active']);
  if (e2) throw e2;
  await supabaseAdmin.from('items').update({ boosted_until: end.toISOString() }).eq('id', b.item_id);
}

export async function rejectBoost(boostId: string, reason: string, reviewer: { id: string }): Promise<void> {
  const { data: b, error } = await supabaseAdmin
    .from('boosts')
    .update({ status: 'rejected', review_note: reason, reviewed_by: reviewer.id, reviewed_at: new Date().toISOString(), next_round_at: null })
    .eq('id', boostId)
    .eq('status', 'pending_review')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!b) throw new BoostError('This boost is no longer waiting for review.', 409, 'NOT_PENDING');
  // Plan: "refund automatically if a boost is rejected". Nothing was charged while free;
  // with payments on, mark the payment for refund here.
  if (b.payment_id) await supabaseAdmin.from('payments').update({ status: 'refunded' }).eq('id', b.payment_id).eq('status', 'paid');
  await notifyOwner(b, 'rejected', reason);
}

/** Stop a boost (owner or admin). Alerts already sent stay sent. */
export async function cancelBoost(boostId: string, by: { userId?: string }): Promise<void> {
  let q = supabaseAdmin.from('boosts').update({ status: 'cancelled', next_round_at: null }).eq('id', boostId).in('status', ['pending_review', 'active']);
  if (by.userId) q = q.eq('user_id', by.userId);
  const { data, error } = await q.select('item_id').maybeSingle();
  if (error) throw error;
  if (!data) throw new BoostError('No running boost to stop.', 404, 'NOT_FOUND');
  await supabaseAdmin.from('items').update({ boosted_until: null }).eq('id', data.item_id);
}

// -------------------------------------------------------------------
// Alert rounds
// -------------------------------------------------------------------
const ALERT_TEXT: Record<Lang, { found: string; lost: string; body: (km: string, address: string) => string }> = {
  en: {
    found: 'Found near you',
    lost: 'Lost near you',
    body: (km, address) => `${km} km away · ${address}\nIs it yours, or have you seen it? Tap to open.`,
  },
  hi: {
    found: 'आपके पास मिला',
    lost: 'आपके पास खोया',
    body: (km, address) => `${km} किमी दूर · ${address}\nक्या यह आपका है, या आपने इसे देखा है? खोलने के लिए टैप करें।`,
  },
};

const OWNER_TEXT: Record<Lang, { live: string; liveBody: (t: string) => string; rejected: string; rejectedBody: (t: string, r: string) => string }> = {
  en: {
    live: 'Your boost is live',
    liveBody: (t) => `“${t}” is pinned to the top and people nearby are being alerted.`,
    rejected: 'Your boost was not approved',
    rejectedBody: (t, r) => `“${t}” was not boosted. Reason: ${r}`,
  },
  hi: {
    live: 'आपका बूस्ट शुरू हो गया',
    liveBody: (t) => `“${t}” सबसे ऊपर दिख रहा है और आस-पास के लोगों को अलर्ट भेजे जा रहे हैं।`,
    rejected: 'आपका बूस्ट स्वीकृत नहीं हुआ',
    rejectedBody: (t, r) => `“${t}” बूस्ट नहीं हुआ। कारण: ${r}`,
  },
};

async function notifyOwner(b: any, what: 'live' | 'rejected', reason = '') {
  try {
    const item = await getItem(b.item_id);
    if (!item) return;
    const prefs = (await getPrefsMany([b.user_id])).get(b.user_id)!;
    const tx = OWNER_TEXT[prefs.lang];
    await createNotifications([
      {
        userId: b.user_id,
        kind: 'boost_update',
        title: what === 'live' ? tx.live : tx.rejected,
        body: what === 'live' ? tx.liveBody(item.title) : tx.rejectedBody(item.title, reason),
        url: `/?item=${encodeURIComponent(item.id)}`,
        itemId: item.id,
        boostId: b.id,
        channels: [],
      },
    ]);
  } catch (e) {
    console.error('[boost] owner notice failed', e);
  }
}

/** Send the next alert round of one boost. Returns how many people were alerted. */
export async function runBoostRound(boostId: string): Promise<number> {
  const { data: b } = await supabaseAdmin.from('boosts').select('*').eq('id', boostId).maybeSingle();
  if (!b || b.status !== 'active' || b.rounds_sent >= b.rounds_total) return 0;
  // Claim this round (another runner may be on it).
  const round = b.rounds_sent + 1;
  const info = BOOST_PACKAGES[b.package as BoostPackage];
  const roundGapMs = (info.durationHours * 3600_000) / info.rounds;
  const next = round < b.rounds_total ? new Date(new Date(b.starts_at).getTime() + round * roundGapMs).toISOString() : null;
  const { data: claimed } = await supabaseAdmin
    .from('boosts')
    .update({ rounds_sent: round, next_round_at: next })
    .eq('id', boostId)
    .eq('rounds_sent', b.rounds_sent)
    .select('id');
  if (!claimed?.length) return 0;

  const item = await getItem(b.item_id);
  if (!item || !isPublicItem(item) || item.status !== 'active') {
    await supabaseAdmin.from('boosts').update({ status: 'cancelled', next_round_at: null }).eq('id', boostId);
    return 0;
  }
  if (round === 1) await notifyOwner(b, 'live');

  const people = await nearbyPeople(item.location.lat, item.location.lng, b.radius_km, item.userId);
  if (!people.length) return 0;
  const ids = people.map((p) => p.userId);

  // Already reached by this boost?
  const { data: done } = await supabaseAdmin.from('boost_recipients').select('user_id').eq('boost_id', boostId).in('user_id', ids);
  const reached = new Set((done ?? []).map((r: any) => String(r.user_id)));
  // Boost alerts each person already got today (IST).
  const { data: today } = await supabaseAdmin
    .from('notifications')
    .select('user_id')
    .eq('kind', 'boost_alert')
    .gte('created_at', istDayStart().toISOString())
    .in('user_id', ids);
  const todayCount = new Map<string, number>();
  for (const r of today ?? []) todayCount.set(String(r.user_id), (todayCount.get(String(r.user_id)) ?? 0) + 1);
  const { data: subs } = await supabaseAdmin.from('push_subscriptions').select('user_id').in('user_id', ids);
  const hasPush = new Set((subs ?? []).map((s: any) => String(s.user_id)));

  const priority = PRIORITY_CATEGORIES.includes(item.category);
  const list: NewNotification[] = [];
  for (const p of people) {
    if (reached.has(p.userId)) continue;
    const sent = todayCount.get(p.userId) ?? 0;
    const cap = priority ? MAX_BOOST_ALERTS_PER_DAY : p.prefs.nearbyDailyLimit;
    if (sent >= cap) continue; // a later round may still reach them on another day
    const tx = ALERT_TEXT[p.prefs.lang];
    list.push({
      userId: p.userId,
      kind: 'boost_alert',
      title: `${item.type === 'found' ? tx.found : tx.lost}: ${item.title}`,
      body: tx.body(p.distanceKm < 1 ? '<1' : p.distanceKm.toFixed(1), item.location.city || item.location.address),
      url: `/?item=${encodeURIComponent(item.id)}&src=boost`,
      itemId: item.id,
      boostId,
      priority: priority ? 1 : 0,
      // Push when they have it on a device; otherwise email as the fallback.
      channels: hasPush.has(p.userId) ? ['push'] : ['email'],
      deliverAfter: quietEndsAt(p.prefs),
    });
  }
  if (!list.length) return 0;

  const { error: rErr } = await supabaseAdmin
    .from('boost_recipients')
    .upsert(list.map((n) => ({ boost_id: boostId, user_id: n.userId, round })), { onConflict: 'boost_id,user_id', ignoreDuplicates: true });
  if (rErr) throw rErr;
  const notifIds = await createNotifications(list);
  await supabaseAdmin.from('boosts').update({ recipients_count: Number(b.recipients_count ?? 0) + list.length }).eq('id', boostId);
  await deliverDue({ ids: notifIds });
  return list.length;
}

/** Rounds that are due + boosts that have ended. For the jobs runner. */
export async function runDueBoosts(): Promise<{ rounds: number; alerted: number; completed: number }> {
  const now = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin.from('boosts').select('id').eq('status', 'active').lte('next_round_at', now).limit(20);
  if (error) throw error;
  let alerted = 0;
  for (const b of due ?? []) alerted += await runBoostRound(b.id);
  const { data: ended } = await supabaseAdmin.from('boosts').update({ status: 'completed', next_round_at: null }).eq('status', 'active').lte('ends_at', now).select('id');
  return { rounds: (due ?? []).length, alerted, completed: (ended ?? []).length };
}
