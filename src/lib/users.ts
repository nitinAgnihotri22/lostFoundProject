// Users data-access layer (server-only)
// -------------------------------------------------
// Shared by the /api/auth/* routes. Uses the Supabase service-role key,
// so it must never be imported from client components.

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export type RoleSource = 'google' | 'normal_register';
export type RoleType = 'social' | 'email';

export interface DbUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role_source: RoleSource;
  role_type: RoleType;
  password_hash: string | null;
  auth_provider_id: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string | null;
  /** Added by migration 07 – undefined on older databases (treated as active). */
  status?: 'active' | 'disabled';
  disabled_reason?: string | null;
}

/** A disabled account can't sign in, and its existing sessions stop working immediately. */
export const isDisabled = (u: Pick<DbUser, 'status'>) => u.status === 'disabled';

export const ACCOUNT_DISABLED_MESSAGE =
  'This account has been disabled. Please contact support if you think this is a mistake.';

/** Shape returned to the browser – never includes password_hash. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  roleSource: RoleSource;
  roleType: RoleType;
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function toPublicUser(u: DbUser): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? undefined,
    avatar: u.avatar ?? undefined,
    roleSource: u.role_source,
    roleType: u.role_type,
  };
}

export async function findUserById(id: string): Promise<DbUser | null> {
  const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as DbUser) ?? null;
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', normalizeEmail(email))
    .maybeSingle();
  if (error) throw error;
  return (data as DbUser) ?? null;
}

export async function findUserByProviderId(providerId: string): Promise<DbUser | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('auth_provider_id', providerId)
    .maybeSingle();
  if (error) throw error;
  return (data as DbUser) ?? null;
}

export async function createUser(input: {
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  roleSource: RoleSource;
  roleType: RoleType;
  passwordHash?: string | null;
  authProviderId?: string | null;
}): Promise<DbUser> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      id: crypto.randomUUID(),
      name: input.name,
      email: normalizeEmail(input.email),
      phone: input.phone ?? null,
      avatar: input.avatar ?? null,
      role_source: input.roleSource,
      role_type: input.roleType,
      password_hash: input.roleType === 'social' ? null : input.passwordHash ?? null,
      auth_provider_id: input.authProviderId ?? null,
      last_login_at: now,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as DbUser;
}

export async function touchLastLogin(id: string, extra: Partial<DbUser> = {}): Promise<DbUser> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ ...extra, last_login_at: now, updated_at: now })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as DbUser;
}

// -------------------------------------------------------------------
// Google identity verification
// -------------------------------------------------------------------
export interface GoogleIdentity {
  providerId: string; // Supabase auth user id
  email: string;
  name: string;
  avatar: string | null;
}

/**
 * Verify a Supabase access token obtained from the Google OAuth callback.
 * The identity is read server-side from Supabase – the browser can't spoof it.
 */
export async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleIdentity | null> {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user || !data.user.email) return null;
  const u = data.user;
  const isGoogle =
    u.app_metadata?.provider === 'google' ||
    (u.identities ?? []).some((i) => i.provider === 'google');
  if (!isGoogle) return null;
  const meta = u.user_metadata ?? {};
  return {
    providerId: u.id,
    email: normalizeEmail(u.email!),
    name: meta.full_name || meta.name || u.email!.split('@')[0],
    avatar: meta.avatar_url || meta.picture || null,
  };
}
