// Supabase (PostgreSQL) data-access layer – server only
// -------------------------------------------------------------------
// Every API route goes through here. Uses the service-role key, which
// bypasses RLS, so this module must never be imported by client code.
// Authorization (who may see/change what) is enforced in the routes.
// -------------------------------------------------------------------

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Item, Claim, Category, Conversation, Message, ConversationParticipant } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export { supabase as supabaseAdmin };

const nowIso = () => new Date().toISOString();
const parseJson = <T,>(value: unknown, fallback: T): T => {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

// ===================================================================
// Items
// ===================================================================
export function mapItemRow(row: any): Item {
  const questions = parseJson<string[] | null>(row.verification_questions, null);
  return {
    id: String(row.id),
    type: String(row.type) as 'found' | 'lost',
    title: String(row.title),
    description: String(row.description),
    category: String(row.category) as Category,
    images: parseJson<string[]>(row.images, []),
    location: {
      lat: Number(row.lat),
      lng: Number(row.lng),
      address: String(row.address),
      city: row.city ? String(row.city) : undefined,
    },
    occurredAt: String(row.occurred_at),
    status: String(row.status) as Item['status'],
    userId: String(row.user_id),
    userName: String(row.user_name || 'Community Member'),
    userEmail: row.user_email ? String(row.user_email) : undefined,
    userPhone: row.user_phone ? String(row.user_phone) : undefined,
    reward: row.reward ? Number(row.reward) : 0,
    verificationQuestions:
      questions && questions.length === 3 ? (questions as [string, string, string]) : undefined,
    createdAt: String(row.created_at),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
    hiddenByAdmin: row.is_hidden === true ? true : undefined,
    hiddenReason: row.is_hidden === true && row.hidden_reason ? String(row.hidden_reason) : undefined,
  };
}

/**
 * Items, newest first. Items hidden by an admin are left out unless `includeHidden`
 * is set (the poster's own list and the admin panel use that).
 */
export async function listItems(
  opts: { status?: Item['status'] | 'all'; userId?: string; includeHidden?: boolean } = {}
): Promise<Item[]> {
  const build = (filterHidden: boolean) => {
    let q = supabase.from('items').select('*').order('created_at', { ascending: false });
    if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status);
    if (opts.userId) q = q.eq('user_id', opts.userId);
    if (filterHidden) q = q.eq('is_hidden', false);
    return q;
  };
  let res = await build(!opts.includeHidden);
  // is_hidden arrives with migration 07 – before that nothing can be hidden anyway.
  if (res.error && !opts.includeHidden && isMissingColumn(res.error)) res = await build(false);
  if (res.error) throw res.error;
  return (res.data as any[]).map(mapItemRow);
}

/** Postgres "undefined column" (42703) or PostgREST schema-cache miss. */
const isMissingColumn = (e: any) => e?.code === '42703' || isMissingSchema(e);

export async function getItem(id: string): Promise<Item | null> {
  const { data, error } = await supabase.from('items').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapItemRow(data) : null;
}

export async function insertItem(item: Omit<Item, 'id' | 'createdAt' | 'status'>): Promise<Item> {
  const now = nowIso();
  const { data, error } = await supabase
    .from('items')
    .insert({
      id: crypto.randomUUID(), // items.id is TEXT with no DB default
      type: item.type,
      title: item.title,
      description: item.description,
      category: item.category,
      images: JSON.stringify(item.images || []),
      lat: item.location.lat,
      lng: item.location.lng,
      address: item.location.address,
      city: item.location.city ?? null,
      occurred_at: item.occurredAt,
      status: 'active',
      user_id: item.userId,
      user_name: item.userName,
      user_email: item.userEmail ?? null,
      user_phone: item.userPhone ?? null,
      reward: item.reward || 0,
      verification_questions: item.verificationQuestions ? JSON.stringify(item.verificationQuestions) : null,
      created_at: now,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapItemRow(data);
}

/** PostgREST error codes for "column/table not in schema cache" (migration not run yet). */
export const isMissingSchema = (e: any) => e?.code === 'PGRST204' || e?.code === 'PGRST205';

export async function updateItemStatus(id: string, status: Item['status']): Promise<Item> {
  const patch: Record<string, unknown> = { status, resolved_at: status === 'active' ? null : nowIso() };
  let res = await supabase.from('items').update(patch).eq('id', id).select('*').single();
  if (res.error && isMissingSchema(res.error)) {
    // resolved_at arrives with migration 05 – don't block the status change on it.
    res = await supabase.from('items').update({ status }).eq('id', id).select('*').single();
  }
  if (res.error) throw res.error;
  return mapItemRow(res.data);
}

/** Delete an item and everything attached to it (explicit, in case the DB FKs lack ON DELETE CASCADE). */
export async function deleteItem(id: string): Promise<void> {
  const convs = await supabase.from('conversations').delete().eq('item_id', id);
  if (convs.error && !isMissingSchema(convs.error)) throw convs.error;
  const claims = await supabase.from('claims').delete().eq('item_id', id);
  if (claims.error) throw claims.error;
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}

// ===================================================================
// Claims
// ===================================================================
function mapClaimRow(row: any): Claim {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    itemTitle: String(row.item_title),
    claimantId: String(row.claimant_id),
    claimantName: String(row.claimant_name),
    claimantEmail: String(row.claimant_email),
    claimantPhone: String(row.claimant_phone ?? ''),
    proof1: String(row.proof_1),
    proof2: String(row.proof_2),
    proof3: String(row.proof_3),
    status: String(row.status) as Claim['status'],
    finderNotes: row.finder_notes ? String(row.finder_notes) : undefined,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    createdAt: String(row.created_at),
  };
}

const claimsQuery = () => supabase.from('claims').select('*').order('created_at', { ascending: false });

export async function listClaimsForItem(itemId: string): Promise<Claim[]> {
  const { data, error } = await claimsQuery().eq('item_id', itemId);
  if (error) throw error;
  return (data as any[]).map(mapClaimRow);
}

export async function listClaimsForItems(itemIds: string[]): Promise<Claim[]> {
  if (itemIds.length === 0) return [];
  const { data, error } = await claimsQuery().in('item_id', itemIds);
  if (error) throw error;
  return (data as any[]).map(mapClaimRow);
}

export async function listClaimsByClaimant(claimantId: string): Promise<Claim[]> {
  const { data, error } = await claimsQuery().eq('claimant_id', claimantId);
  if (error) throw error;
  return (data as any[]).map(mapClaimRow);
}

export async function getClaim(id: string): Promise<Claim | null> {
  const { data, error } = await supabase.from('claims').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapClaimRow(data) : null;
}

export async function insertClaim(claim: Omit<Claim, 'id' | 'createdAt' | 'status'>): Promise<Claim> {
  const { data, error } = await supabase
    .from('claims')
    .insert({
      id: crypto.randomUUID(), // claims.id is TEXT with no DB default
      item_id: claim.itemId,
      item_title: claim.itemTitle,
      claimant_id: claim.claimantId,
      claimant_name: claim.claimantName,
      claimant_email: claim.claimantEmail,
      claimant_phone: claim.claimantPhone,
      proof_1: claim.proof1,
      proof_2: claim.proof2,
      proof_3: claim.proof3,
      status: 'pending',
      created_at: nowIso(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapClaimRow(data);
}

/** Approve/reject a claim. `reason` is stored as rejection_reason (rejected) or finder_notes (approved). */
export async function updateClaimStatus(
  id: string,
  status: 'approved' | 'rejected',
  reason: string | null
): Promise<Claim> {
  const { data, error } = await supabase
    .from('claims')
    .update({
      status,
      rejection_reason: status === 'rejected' ? reason : null,
      finder_notes: status === 'approved' ? reason : null,
      reviewed_at: nowIso(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapClaimRow(data);
}

/** When one claim is approved, every other pending claim on the item is rejected automatically. */
export async function rejectOtherPendingClaims(itemId: string, approvedClaimId: string, reason: string): Promise<number> {
  const { data, error } = await supabase
    .from('claims')
    .update({ status: 'rejected', rejection_reason: reason, reviewed_at: nowIso() })
    .eq('item_id', itemId)
    .eq('status', 'pending')
    .neq('id', approvedClaimId)
    .select('id');
  if (error) throw error;
  return (data as any[]).length;
}

// ===================================================================
// Users (public fields only)
// ===================================================================
export async function getUsersByIds(ids: string[]): Promise<Map<string, ConversationParticipant>> {
  const map = new Map<string, ConversationParticipant>();
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return map;
  const { data, error } = await supabase.from('users').select('id,name,avatar').in('id', unique);
  if (error) throw error;
  for (const row of data as any[]) {
    map.set(String(row.id), {
      id: String(row.id),
      name: String(row.name),
      avatar: row.avatar ? String(row.avatar) : undefined,
    });
  }
  return map;
}

// ===================================================================
// Conversations & messages
// ===================================================================
const orderPair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

async function hydrateConversations(rows: any[], viewerId: string): Promise<Conversation[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r.id));
  const userIds = rows.flatMap((r) => [String(r.user_low), String(r.user_high)]);
  const itemIds = Array.from(new Set(rows.map((r) => String(r.item_id))));

  const [users, itemsRes, unreadRes] = await Promise.all([
    getUsersByIds(userIds),
    supabase.from('items').select('id,title,type,status,images,user_id').in('id', itemIds),
    supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', ids)
      .neq('sender_id', viewerId)
      .is('read_at', null),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (unreadRes.error) throw unreadRes.error;

  const items = new Map((itemsRes.data as any[]).map((r) => [String(r.id), r]));
  const unread = new Map<string, number>();
  for (const m of unreadRes.data as any[]) {
    unread.set(String(m.conversation_id), (unread.get(String(m.conversation_id)) ?? 0) + 1);
  }

  return rows.map((r) => {
    const otherId = String(r.user_low) === viewerId ? String(r.user_high) : String(r.user_low);
    const item = items.get(String(r.item_id));
    return {
      id: String(r.id),
      itemId: String(r.item_id),
      item: item
        ? {
            id: String(item.id),
            title: String(item.title),
            type: String(item.type) as 'found' | 'lost',
            status: String(item.status) as Item['status'],
            image: parseJson<string[]>(item.images, [])[0],
            posterId: String(item.user_id),
          }
        : undefined,
      participant: users.get(otherId) ?? { id: otherId, name: 'Former member' },
      lastMessageAt: r.last_message_at ? String(r.last_message_at) : undefined,
      lastMessagePreview: r.last_message_preview ? String(r.last_message_preview) : undefined,
      lastSenderId: r.last_sender_id ? String(r.last_sender_id) : undefined,
      unreadCount: unread.get(String(r.id)) ?? 0,
      createdAt: String(r.created_at),
    };
  });
}

export async function listConversationsForUser(userId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`user_low.eq.${userId},user_high.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return hydrateConversations(data as any[], userId);
}

export async function getConversationForUser(id: string, userId: string): Promise<Conversation | null> {
  const { data, error } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (String(data.user_low) !== userId && String(data.user_high) !== userId) return null;
  return (await hydrateConversations([data], userId))[0];
}

export async function findOrCreateConversation(itemId: string, userA: string, userB: string): Promise<{ conversation: Conversation; created: boolean }> {
  const [low, high] = orderPair(userA, userB);
  const existing = await supabase
    .from('conversations')
    .select('*')
    .eq('item_id', itemId)
    .eq('user_low', low)
    .eq('user_high', high)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    return { conversation: (await hydrateConversations([existing.data], userA))[0], created: false };
  }
  const inserted = await supabase
    .from('conversations')
    .insert({ id: crypto.randomUUID(), item_id: itemId, user_low: low, user_high: high, created_at: nowIso() })
    .select('*')
    .single();
  if (inserted.error) {
    // Unique violation: the other user created it concurrently – fetch theirs.
    if ((inserted.error as any).code === '23505') return findOrCreateConversation(itemId, userA, userB);
    throw inserted.error;
  }
  return { conversation: (await hydrateConversations([inserted.data], userA))[0], created: true };
}

function mapMessageRow(row: any): Message {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    body: String(row.body),
    readAt: row.read_at ? String(row.read_at) : undefined,
    createdAt: String(row.created_at),
  };
}

export async function listMessages(conversationId: string, after?: string, limit = 200): Promise<Message[]> {
  let q = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (after) q = q.gt('created_at', after);
  const { data, error } = await q;
  if (error) throw error;
  return (data as any[]).map(mapMessageRow);
}

export async function insertMessage(conversationId: string, senderId: string, body: string): Promise<Message> {
  const now = nowIso();
  const { data, error } = await supabase
    .from('messages')
    .insert({ id: crypto.randomUUID(), conversation_id: conversationId, sender_id: senderId, body, created_at: now })
    .select('*')
    .single();
  if (error) throw error;
  const { error: convError } = await supabase
    .from('conversations')
    .update({ last_message_at: now, last_message_preview: body.slice(0, 120), last_sender_id: senderId })
    .eq('id', conversationId);
  if (convError) throw convError;
  return mapMessageRow(data);
}

/** Mark every message from the other participant as read. */
export async function markConversationRead(conversationId: string, readerId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: nowIso() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', readerId)
    .is('read_at', null);
  if (error) throw error;
}

export async function countUnreadForUser(userId: string): Promise<number> {
  const convs = await supabase
    .from('conversations')
    .select('id')
    .or(`user_low.eq.${userId},user_high.eq.${userId}`);
  if (convs.error) throw convs.error;
  const ids = (convs.data as any[]).map((r) => String(r.id));
  if (ids.length === 0) return 0;
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', ids)
    .neq('sender_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

// ===================================================================
// Photo storage
// ===================================================================
export const PHOTO_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'item-photos';

export async function uploadPhoto(path: string, bytes: ArrayBuffer, contentType: string): Promise<string> {
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ===================================================================
// Contact Us messages (migration 06_contact_messages.sql)
// ===================================================================
export const CONTACT_SUBJECTS = ['general', 'listing', 'claim', 'account', 'accessibility', 'partnership', 'other'] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export interface NewContactMessage {
  name: string;
  email: string;
  phone?: string;
  subject: ContactSubject;
  message: string;
  lang: string;
  userId?: string | null;
  pageUrl?: string;
  userAgent?: string;
}

/** Short, unambiguous reference for the sender (no 0/O/1/I). */
function contactReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  return 'LF-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export async function insertContactMessage(msg: NewContactMessage): Promise<{ id: string; reference: string }> {
  const id = crypto.randomUUID();
  const reference = contactReference();
  const { error } = await supabase.from('contact_messages').insert({
    id,
    reference,
    name: msg.name,
    email: msg.email,
    phone: msg.phone || null,
    subject: msg.subject,
    message: msg.message,
    lang: msg.lang,
    user_id: msg.userId ?? null,
    page_url: msg.pageUrl?.slice(0, 500) || null,
    user_agent: msg.userAgent?.slice(0, 500) || null,
    created_at: nowIso(),
  });
  if (error) throw error;
  return { id, reference };
}
