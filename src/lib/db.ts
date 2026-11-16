// Supabase (PostgreSQL) data‑access layer
// -------------------------------------------------
// This file replaces the previous SQLite implementation.
// It uses the official Supabase JS client on the server side
// (service role key) to perform CRUD operations for items and
// claims. The client is instantiated once per request.
// -------------------------------------------------

import crypto from 'crypto';
import { lazySupabase, requireEnv } from './lazySupabase';
import { Item, Claim, Category } from '@/types';

// -------------------------------------------------------------------
// Supabase client – service role key (keep secret, not exposed to the
// browser). Values are read from environment variables.
// -------------------------------------------------------------------
const supabase = lazySupabase(
  () => requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  () => requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
);

// -------------------------------------------------------------------
// Item helpers
// -------------------------------------------------------------------
export async function getAllDbItems(): Promise<Item[]> {
  const { data, error } = await supabase.from('items').select('*');
  if (error) throw error;
  // The DB stores JSON fields as strings – parse them for the frontend.
  return (data as any[]).map((row) => ({
    id: String(row.id),
    type: String(row.type) as 'found' | 'lost',
    title: String(row.title),
    description: String(row.description),
    category: String(row.category) as Category,
    images: row.images ? JSON.parse(String(row.images)) : [],
    location: {
      lat: Number(row.lat),
      lng: Number(row.lng),
      address: String(row.address),
      city: row.city ? String(row.city) : undefined,
    },
    occurredAt: String(row.occurred_at),
    status: String(row.status) as 'active' | 'claimed' | 'resolved',
    userId: String(row.user_id || 'guest'),
    userName: String(row.user_name || 'Community Member'),
    userEmail: String(row.user_email || 'user@example.com'),
    userPhone: row.user_phone ? String(row.user_phone) : undefined,
    reward: row.reward ? Number(row.reward) : 0,
    verificationQuestions: row.verification_questions
      ? JSON.parse(String(row.verification_questions))
      : undefined,
    createdAt: String(row.created_at),
  }));
}

export async function insertDbItem(
  item: Omit<Item, 'id' | 'createdAt' | 'status'>
): Promise<Item> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('items').insert({
    // items.id is TEXT with no DB default (see 01_create_tables.sql) – generate it here.
    id: crypto.randomUUID(),
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
    user_id: item.userId || 'guest',
    user_name: item.userName || 'Community Member',
    user_email: item.userEmail || 'user@example.com',
    user_phone: item.userPhone ?? null,
    reward: item.reward || 0,
    verification_questions: item.verificationQuestions
      ? JSON.stringify(item.verificationQuestions)
      : null,
    created_at: now,
  }).select();

  if (error) throw error;
  // Supabase returns the inserted row(s) in `data`.
  const row = (data as any[])[0];
  return {
    ...item,
    id: String(row.id),
    status: 'active',
    createdAt: now,
  };
}

// -------------------------------------------------------------------
// Claim helpers
// -------------------------------------------------------------------
function mapClaimRow(row: any): Claim {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    itemTitle: String(row.item_title),
    claimantId: String(row.claimant_id),
    claimantName: String(row.claimant_name),
    claimantEmail: String(row.claimant_email),
    claimantPhone: String(row.claimant_phone),
    proof1: String(row.proof_1),
    proof2: String(row.proof_2),
    proof3: String(row.proof_3),
    status: String(row.status) as 'pending' | 'approved' | 'rejected',
    finderNotes: row.finder_notes ? String(row.finder_notes) : undefined,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    createdAt: String(row.created_at),
  };
}

export async function getAllDbClaims(): Promise<Claim[]> {
  const { data, error } = await supabase.from('claims').select('*');
  if (error) throw error;
  return (data as any[]).map(mapClaimRow);
}

export async function getDbClaimById(id: string): Promise<Claim | null> {
  const { data, error } = await supabase.from('claims').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapClaimRow(data) : null;
}

/** Approve/reject a claim. `reason` is stored as rejection_reason (rejected) or finder_notes (approved). */
export async function updateDbClaimStatus(
  id: string,
  status: 'approved' | 'rejected',
  reason: string | null
): Promise<Claim> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('claims')
    .update({
      status,
      rejection_reason: status === 'rejected' ? reason : null,
      finder_notes: status === 'approved' ? reason : null,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapClaimRow(data);
}

export async function insertDbClaim(
  claim: Omit<Claim, 'id' | 'createdAt' | 'status'>
): Promise<Claim> {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('claims').insert({
    // claims.id is TEXT with no DB default – generate it here.
    id: crypto.randomUUID(),
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
    created_at: now,
  }).select();

  if (error) throw error;
  const row = (data as any[])[0];
  return {
    ...claim,
    id: String(row.id),
    status: 'pending',
    createdAt: now,
  };
}
