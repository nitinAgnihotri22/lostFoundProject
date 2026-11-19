// Admin panel queries (server only). Every function assumes the caller has
// already passed requireAdmin() with the right permission.
import crypto from 'crypto';
import { supabaseAdmin, mapItemRow } from '@/lib/db';
import { calculateDistanceKm } from '@/lib/geo';
import type { Item } from '@/types';
import type { DbAdmin } from './server';

const nowIso = () => new Date().toISOString();

/** Remove characters that would break a PostgREST `or=(…)` filter or act as wildcards. */
const cleanSearch = (s: string) => s.replace(/[,()%*\\_:"']/g, ' ').trim().slice(0, 100);
/** Escape LIKE wildcards for an exact, case-insensitive match. */
const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

const pageRange = (page: number, pageSize: number) => {
  const p = Math.max(1, Math.floor(page) || 1);
  const size = Math.min(100, Math.max(5, Math.floor(pageSize) || 25));
  return { p, size, from: (p - 1) * size, to: p * size - 1 };
};

async function count(table: string, apply?: (q: any) => any): Promise<number> {
  let q: any = supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
}

// ===================================================================
// Dashboard
// ===================================================================
export async function dashboardStats() {
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [
    usersTotal, usersDisabled, usersNew,
    itemsTotal, itemsLive, itemsHidden, itemsClosed, itemsNew, found, lost,
    claimsPending, claimsApproved, messagesNew, reviewPending,
  ] = await Promise.all([
    count('users'),
    count('users', (q) => q.eq('status', 'disabled')),
    count('users', (q) => q.gte('created_at', weekAgo)),
    count('items'),
    count('items', (q) => q.eq('status', 'active').eq('is_hidden', false).eq('review_status', 'approved')),
    count('items', (q) => q.eq('is_hidden', true)),
    count('items', (q) => q.in('status', ['claimed', 'resolved'])),
    count('items', (q) => q.gte('created_at', weekAgo)),
    count('items', (q) => q.eq('type', 'found')),
    count('items', (q) => q.eq('type', 'lost')),
    count('claims', (q) => q.eq('status', 'pending')),
    count('claims', (q) => q.eq('status', 'approved')),
    count('contact_messages', (q) => q.eq('status', 'new')).catch(() => 0),
    countPendingReview(),
  ]);

  const [recentItems, recentUsers, cities] = await Promise.all([
    supabaseAdmin.from('items').select('id,title,type,city,address,status,is_hidden,review_status,created_at,user_name').order('created_at', { ascending: false }).limit(6),
    supabaseAdmin.from('users').select('id,name,email,status,created_at,role_source').order('created_at', { ascending: false }).limit(6),
    listCities(),
  ]);
  if (recentItems.error) throw recentItems.error;
  if (recentUsers.error) throw recentUsers.error;

  // Posts per day for the last 14 days.
  const since = new Date(Date.now() - 13 * 86400_000);
  since.setHours(0, 0, 0, 0);
  const daily = await supabaseAdmin.from('items').select('created_at,type').gte('created_at', since.toISOString()).limit(10000);
  if (daily.error) throw daily.error;
  const perDay: { day: string; found: number; lost: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since.getTime() + i * 86400_000);
    perDay.push({ day: d.toISOString().slice(0, 10), found: 0, lost: 0 });
  }
  for (const r of daily.data as any[]) {
    const key = new Date(r.created_at).toISOString().slice(0, 10);
    const slot = perDay.find((p) => p.day === key);
    if (slot) slot[r.type === 'lost' ? 'lost' : 'found']++;
  }

  return {
    users: { total: usersTotal, disabled: usersDisabled, newThisWeek: usersNew },
    items: { total: itemsTotal, live: itemsLive, hidden: itemsHidden, closed: itemsClosed, newThisWeek: itemsNew, found, lost },
    claims: { pending: claimsPending, approved: claimsApproved },
    review: { pending: reviewPending },
    messages: { new: messagesNew },
    recentItems: recentItems.data,
    recentUsers: recentUsers.data,
    topCities: cities.slice(0, 6),
    perDay,
  };
}

// ===================================================================
// Posts (items)
// ===================================================================
export interface AdminPost extends Item {
  isHidden: boolean;
  hiddenAt?: string;
  hiddenSource?: string;
  hiddenBy?: string;
  claimCount: number;
  poster: { id: string; name: string; email?: string; status: 'active' | 'disabled' | 'deleted'; postCount?: number; rejectedCount?: number };
  distanceKm?: number;
  reviewedAt?: string;
  reviewedByName?: string;
  /** Raw review note, including on approved posts. */
  reviewNoteRaw?: string;
}

export interface PostFilters {
  search?: string;
  city?: string;
  type?: 'found' | 'lost';
  status?: Item['status'];
  visibility?: 'visible' | 'hidden';
  review?: 'pending' | 'approved' | 'rejected';
  /** Oldest first (the review queue). Default is newest first. */
  oldestFirst?: boolean;
  userId?: string;
  near?: { lat: number; lng: number; radiusKm: number };
  page?: number;
  pageSize?: number;
}

async function decoratePosts(rows: any[]): Promise<AdminPost[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r.id));
  const userIds = Array.from(new Set(rows.map((r) => String(r.user_id)).filter(Boolean)));
  const reviewerIds = Array.from(new Set(rows.map((r) => r.reviewed_by).filter(Boolean).map(String)));
  const [claims, users, reviewers, history] = await Promise.all([
    supabaseAdmin.from('claims').select('item_id').in('item_id', ids),
    userIds.length ? supabaseAdmin.from('users').select('id,name,email,status').in('id', userIds) : Promise.resolve({ data: [], error: null }),
    reviewerIds.length ? supabaseAdmin.from('admin_users').select('id,name').in('id', reviewerIds) : Promise.resolve({ data: [], error: null }),
    // Poster history helps the checker: how many posts, how many were rejected.
    userIds.length ? supabaseAdmin.from('items').select('user_id,review_status').in('user_id', userIds).limit(10000) : Promise.resolve({ data: [], error: null }),
  ]);
  if (claims.error) throw claims.error;
  if (users.error) throw users.error;
  const reviewerMap = new Map(((reviewers.data ?? []) as any[]).map((a) => [String(a.id), String(a.name)]));
  const postCounts = new Map<string, { total: number; rejected: number }>();
  for (const h of (history.data ?? []) as any[]) {
    const c = postCounts.get(String(h.user_id)) ?? { total: 0, rejected: 0 };
    c.total++;
    if (h.review_status === 'rejected') c.rejected++;
    postCounts.set(String(h.user_id), c);
  }
  const claimCounts = new Map<string, number>();
  for (const c of claims.data as any[]) claimCounts.set(String(c.item_id), (claimCounts.get(String(c.item_id)) ?? 0) + 1);
  const userMap = new Map((users.data as any[]).map((u) => [String(u.id), u]));

  return rows.map((r) => {
    const u = userMap.get(String(r.user_id));
    return {
      ...mapItemRow(r),
      userEmail: r.user_email ? String(r.user_email) : undefined,
      userPhone: r.user_phone ? String(r.user_phone) : undefined,
      isHidden: r.is_hidden === true,
      hiddenAt: r.hidden_at ?? undefined,
      hiddenReason: r.hidden_reason ?? undefined,
      hiddenSource: r.hidden_source ?? undefined,
      hiddenBy: r.hidden_by ?? undefined,
      claimCount: claimCounts.get(String(r.id)) ?? 0,
      poster: {
        ...(u
          ? { id: String(u.id), name: String(u.name), email: u.email ? String(u.email) : undefined, status: u.status === 'disabled' ? ('disabled' as const) : ('active' as const) }
          : { id: String(r.user_id), name: String(r.user_name || 'Unknown'), status: 'deleted' as const }),
        postCount: postCounts.get(String(r.user_id))?.total,
        rejectedCount: postCounts.get(String(r.user_id))?.rejected,
      },
      distanceKm: typeof r._distanceKm === 'number' ? Math.round(r._distanceKm * 10) / 10 : undefined,
      reviewedAt: r.reviewed_at ?? undefined,
      reviewedByName: r.reviewed_by ? reviewerMap.get(String(r.reviewed_by)) : undefined,
      reviewNoteRaw: r.review_note ?? undefined,
    } satisfies AdminPost;
  });
}

export async function listPosts(f: PostFilters): Promise<Page<AdminPost>> {
  const { p, size, from, to } = pageRange(f.page ?? 1, f.pageSize ?? 25);

  const apply = (q: any) => {
    const s = f.search ? cleanSearch(f.search) : '';
    if (s) q = q.or(`title.ilike.*${s}*,description.ilike.*${s}*,address.ilike.*${s}*,user_name.ilike.*${s}*,user_email.ilike.*${s}*`);
    if (f.city) q = f.city === '__none__' ? q.is('city', null) : q.ilike('city', likeExact(f.city));
    if (f.type) q = q.eq('type', f.type);
    if (f.status) q = q.eq('status', f.status);
    if (f.visibility) q = q.eq('is_hidden', f.visibility === 'hidden');
    if (f.review) q = q.eq('review_status', f.review);
    if (f.userId) q = q.eq('user_id', f.userId);
    return q;
  };

  if (f.near) {
    // Bounding box in SQL, exact distance + paging in JS (sorted nearest first).
    const { lat, lng, radiusKm } = f.near;
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
    const { data, error } = await apply(
      supabaseAdmin.from('items').select('*').gte('lat', lat - dLat).lte('lat', lat + dLat).gte('lng', lng - dLng).lte('lng', lng + dLng).limit(5000)
    );
    if (error) throw error;
    const within = (data as any[])
      .map((r) => ({ ...r, _distanceKm: calculateDistanceKm(lat, lng, Number(r.lat), Number(r.lng)) }))
      .filter((r) => r._distanceKm <= radiusKm)
      .sort((a, b) => a._distanceKm - b._distanceKm);
    return { rows: await decoratePosts(within.slice(from, to + 1)), total: within.length, page: p, pageSize: size };
  }

  const { data, error, count: total } = await apply(
    supabaseAdmin.from('items').select('*', { count: 'exact' }).order('created_at', { ascending: !!f.oldestFirst }).range(from, to)
  );
  if (error) throw error;
  return { rows: await decoratePosts(data as any[]), total: total ?? 0, page: p, pageSize: size };
}

export async function getPost(id: string): Promise<AdminPost | null> {
  const { data, error } = await supabaseAdmin.from('items').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await decoratePosts([data]))[0];
}

/** Every city that has posts, with counts, most posts first. */
export async function listCities(): Promise<{ city: string; count: number }[]> {
  const { data, error } = await supabaseAdmin.from('items').select('city').limit(20000);
  if (error) throw error;
  const counts = new Map<string, { city: string; count: number }>();
  for (const r of data as any[]) {
    const city = r.city ? String(r.city).trim() : '';
    if (!city) continue;
    const key = city.toLowerCase();
    const cur = counts.get(key) ?? { city, count: 0 };
    cur.count++;
    counts.set(key, cur);
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
}

export async function setPostsHidden(ids: string[], hidden: boolean, reason: string | null, admin: DbAdmin): Promise<number> {
  const patch = hidden
    ? { is_hidden: true, hidden_at: nowIso(), hidden_reason: reason, hidden_by: admin.id, hidden_source: 'admin' }
    : { is_hidden: false, hidden_at: null, hidden_reason: null, hidden_by: null, hidden_source: null };
  const { data, error } = await supabaseAdmin.from('items').update(patch).in('id', ids).select('id');
  if (error) throw error;
  return (data as any[]).length;
}

/** Posts waiting for a checker. */
export async function countPendingReview(): Promise<number> {
  return count('items', (q) => q.eq('review_status', 'pending'));
}

/**
 * Maker-checker decision. Approve works on pending (or previously rejected) posts;
 * reject only on pending ones – to take a live post down, hide it instead.
 * Returns the ids that actually changed (others were already decided by someone else).
 */
export async function reviewPosts(ids: string[], decision: 'approve' | 'reject', note: string | null, admin: DbAdmin): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('items')
    .update({
      review_status: decision === 'approve' ? 'approved' : 'rejected',
      review_note: note,
      reviewed_by: admin.id,
      reviewed_at: nowIso(),
    })
    .in('id', ids)
    .in('review_status', decision === 'approve' ? ['pending', 'rejected'] : ['pending'])
    .select('id');
  if (error) throw error;
  return (data as any[]).map((r) => String(r.id));
}

// ===================================================================
// Website users
// ===================================================================
export interface AdminWebUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  signIn: 'google' | 'email' | 'phone';
  phoneVerified: boolean;
  status: 'active' | 'disabled';
  disabledAt?: string;
  disabledReason?: string;
  createdByAdmin: boolean;
  lastLoginAt?: string;
  createdAt: string;
  postCount: number;
  claimCount: number;
}

export interface UserFilters {
  search?: string;
  status?: 'active' | 'disabled';
  page?: number;
  pageSize?: number;
}

async function decorateUsers(rows: any[]): Promise<AdminWebUser[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r.id));
  const [items, claims] = await Promise.all([
    supabaseAdmin.from('items').select('user_id').in('user_id', ids),
    supabaseAdmin.from('claims').select('claimant_id').in('claimant_id', ids),
  ]);
  if (items.error) throw items.error;
  if (claims.error) throw claims.error;
  const posts = new Map<string, number>();
  for (const r of items.data as any[]) posts.set(String(r.user_id), (posts.get(String(r.user_id)) ?? 0) + 1);
  const cl = new Map<string, number>();
  for (const r of claims.data as any[]) cl.set(String(r.claimant_id), (cl.get(String(r.claimant_id)) ?? 0) + 1);

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    email: r.email ? String(r.email) : undefined,
    phone: r.phone_e164 ?? r.phone ?? undefined,
    avatar: r.avatar ?? undefined,
    signIn: r.role_type === 'social' ? 'google' : r.role_type === 'phone' ? 'phone' : 'email',
    phoneVerified: !!r.phone_e164,
    status: r.status === 'disabled' ? 'disabled' : 'active',
    disabledAt: r.disabled_at ?? undefined,
    disabledReason: r.disabled_reason ?? undefined,
    createdByAdmin: !!r.created_by_admin,
    lastLoginAt: r.last_login_at ?? undefined,
    createdAt: String(r.created_at),
    postCount: posts.get(String(r.id)) ?? 0,
    claimCount: cl.get(String(r.id)) ?? 0,
  }));
}

const USER_COLUMNS = 'id,name,email,phone,phone_e164,avatar,role_type,status,disabled_at,disabled_reason,created_by_admin,last_login_at,created_at';

export async function listWebUsers(f: UserFilters): Promise<Page<AdminWebUser>> {
  const { p, size, from, to } = pageRange(f.page ?? 1, f.pageSize ?? 25);
  let q: any = supabaseAdmin.from('users').select(USER_COLUMNS, { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  const s = f.search ? cleanSearch(f.search) : '';
  if (s) q = q.or(`name.ilike.*${s}*,email.ilike.*${s}*,phone.ilike.*${s}*`);
  if (f.status) q = q.eq('status', f.status);
  const { data, error, count: total } = await q;
  if (error) throw error;
  return { rows: await decorateUsers(data as any[]), total: total ?? 0, page: p, pageSize: size };
}

export async function getWebUser(id: string): Promise<AdminWebUser | null> {
  const { data, error } = await supabaseAdmin.from('users').select(USER_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? (await decorateUsers([data]))[0] : null;
}

/**
 * Disable or re-enable a website user. Disabling also hides their posts that are
 * currently visible (hidden_source = 'user_disabled'); re-enabling brings back only
 * those, never posts an admin hid by hand.
 */
export async function setWebUserStatus(
  id: string,
  disabled: boolean,
  reason: string | null,
  admin: DbAdmin,
  hidePosts: boolean
): Promise<{ postsChanged: number }> {
  const { error } = await supabaseAdmin
    .from('users')
    .update(disabled ? { status: 'disabled', disabled_at: nowIso(), disabled_reason: reason } : { status: 'active', disabled_at: null, disabled_reason: null })
    .eq('id', id);
  if (error) throw error;

  if (disabled && hidePosts) {
    const res = await supabaseAdmin
      .from('items')
      .update({ is_hidden: true, hidden_at: nowIso(), hidden_reason: 'Account disabled', hidden_by: admin.id, hidden_source: 'user_disabled' })
      .eq('user_id', id)
      .eq('is_hidden', false)
      .select('id');
    if (res.error) throw res.error;
    return { postsChanged: (res.data as any[]).length };
  }
  if (!disabled) {
    const res = await supabaseAdmin
      .from('items')
      .update({ is_hidden: false, hidden_at: null, hidden_reason: null, hidden_by: null, hidden_source: null })
      .eq('user_id', id)
      .eq('hidden_source', 'user_disabled')
      .select('id');
    if (res.error) throw res.error;
    return { postsChanged: (res.data as any[]).length };
  }
  return { postsChanged: 0 };
}

// ===================================================================
// Contact messages
// ===================================================================
export const MESSAGE_STATUSES = ['new', 'in_progress', 'resolved', 'spam'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export async function listMessages(f: { search?: string; status?: MessageStatus; subject?: string; page?: number; pageSize?: number }) {
  const { p, size, from, to } = pageRange(f.page ?? 1, f.pageSize ?? 25);
  let q: any = supabaseAdmin.from('contact_messages').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  const s = f.search ? cleanSearch(f.search) : '';
  if (s) q = q.or(`name.ilike.*${s}*,email.ilike.*${s}*,reference.ilike.*${s}*,message.ilike.*${s}*`);
  if (f.status) q = q.eq('status', f.status);
  if (f.subject) q = q.eq('subject', f.subject);
  const { data, error, count: total } = await q;
  if (error) throw error;
  return { rows: data as any[], total: total ?? 0, page: p, pageSize: size };
}

export async function updateMessage(id: string, patch: { status?: MessageStatus; admin_note?: string | null }, admin: DbAdmin) {
  const { data, error } = await supabaseAdmin
    .from('contact_messages')
    .update({ ...patch, handled_by: admin.id })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ===================================================================
// Audit log
// ===================================================================
export async function listAudit(f: { adminId?: string; action?: string; page?: number; pageSize?: number }) {
  const { p, size, from, to } = pageRange(f.page ?? 1, f.pageSize ?? 50);
  let q: any = supabaseAdmin.from('admin_audit_log').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (f.adminId) q = q.eq('admin_id', f.adminId);
  if (f.action) q = q.like('action', `${likeExact(cleanSearch(f.action))}%`);
  const { data, error, count: total } = await q;
  if (error) throw error;
  return { rows: data as any[], total: total ?? 0, page: p, pageSize: size };
}

export const newId = () => crypto.randomUUID();
