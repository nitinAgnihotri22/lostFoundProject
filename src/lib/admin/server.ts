// Admin accounts, sessions and audit log (server only)
// -------------------------------------------------------------------
// Admins are stored in `admin_users`, completely separate from website
// `users`. Sessions use their own cookie (lf_admin) signed with their own
// key, so a website session is never accepted here and vice versa.
// -------------------------------------------------------------------
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { supabaseAdmin, isMissingSchema } from '@/lib/db';
import { ADMIN_COOKIE, hashPassword, verifyAdminToken } from '@/lib/auth';
import { ValidationError } from '@/lib/validation';
import { AdminProfile, AdminRole, Permission, can } from './permissions';

export interface DbAdmin {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  session_version: number;
  must_change_password: boolean;
  failed_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const toAdminProfile = (a: DbAdmin): AdminProfile => ({
  id: a.id,
  name: a.name,
  email: a.email,
  role: a.role,
  status: a.status,
  mustChangePassword: !!a.must_change_password,
  lastLoginAt: a.last_login_at,
  createdAt: a.created_at,
  createdBy: a.created_by,
});

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
const nowIso = () => new Date().toISOString();

// -------------------------------------------------------------------
// Data access
// -------------------------------------------------------------------
export async function findAdminById(id: string): Promise<DbAdmin | null> {
  const { data, error } = await supabaseAdmin.from('admin_users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as DbAdmin) ?? null;
}

export async function findAdminByEmail(email: string): Promise<DbAdmin | null> {
  const { data, error } = await supabaseAdmin.from('admin_users').select('*').eq('email', normalizeEmail(email)).maybeSingle();
  if (error) throw error;
  return (data as DbAdmin) ?? null;
}

export async function listAdmins(): Promise<DbAdmin[]> {
  const { data, error } = await supabaseAdmin.from('admin_users').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data as DbAdmin[];
}

export async function insertAdmin(input: {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  createdBy: string | null;
  mustChangePassword: boolean;
}): Promise<DbAdmin> {
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .insert({
      id: crypto.randomUUID(),
      name: input.name,
      email: normalizeEmail(input.email),
      password_hash: hashPassword(input.password),
      role: input.role,
      status: 'active',
      must_change_password: input.mustChangePassword,
      created_by: input.createdBy,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as DbAdmin;
}

export async function updateAdmin(id: string, patch: Partial<DbAdmin>): Promise<DbAdmin> {
  const { data, error } = await supabaseAdmin.from('admin_users').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data as DbAdmin;
}

/** Ends every existing session of this admin (password change, disable, "sign out everywhere"). */
export async function bumpSessionVersion(a: DbAdmin, extra: Partial<DbAdmin> = {}): Promise<DbAdmin> {
  return updateAdmin(a.id, { ...extra, session_version: (a.session_version ?? 1) + 1 });
}

// -------------------------------------------------------------------
// Sessions
// -------------------------------------------------------------------
async function adminFromToken(token: string | undefined | null): Promise<DbAdmin | null> {
  const payload = token ? verifyAdminToken(token) : null;
  if (!payload) return null;
  const admin = await findAdminById(payload.adminId).catch(() => null);
  if (!admin || admin.status !== 'active' || admin.session_version !== payload.sv) return null;
  return admin;
}

/** For server components (the /admin layout and pages). Cached per request. */
export const getAdminFromCookies = cache(async (): Promise<DbAdmin | null> => {
  const store = await cookies();
  return adminFromToken(store.get(ADMIN_COOKIE)?.value);
});

/** Server-side page guard: no session → login; role lacks the permission → dashboard. */
export async function requirePagePermission(perm: Permission): Promise<DbAdmin> {
  const admin = await getAdminFromCookies().catch(() => null);
  if (!admin) redirect('/admin/login');
  if (!can(admin.role, perm)) redirect(perm === 'dashboard.view' ? '/admin/account' : '/admin');
  return admin;
}

export const adminFail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ success: false, error, ...extra }, { status });

/** Reject cross-site form posts: a browser always sends Origin on POST/PATCH/PUT/DELETE. */
function sameOrigin(req: NextRequest): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser client (curl, scripts) – still needs the cookie
  try {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type AdminAuth = { admin: DbAdmin; response?: undefined } | { admin?: undefined; response: NextResponse };

/**
 * Guard for /api/admin/* routes. Pass `null` as the permission for routes every
 * signed-in admin may use (own account), which also stay open while a password
 * change is pending.
 */
export async function requireAdmin(req: NextRequest, perm: Permission | null): Promise<AdminAuth> {
  if (!sameOrigin(req)) return { response: adminFail(403, 'Cross-site request blocked.', { code: 'BAD_ORIGIN' }) };
  let admin: DbAdmin | null;
  try {
    admin = await adminFromToken(req.cookies.get(ADMIN_COOKIE)?.value);
  } catch (e) {
    if (isMissingSchema(e)) return { response: migrationRequired() };
    throw e;
  }
  if (!admin) return { response: adminFail(401, 'Admin sign-in required.', { code: 'ADMIN_UNAUTHENTICATED' }) };
  if (perm && admin.must_change_password) {
    return { response: adminFail(403, 'Change your password before continuing.', { code: 'PASSWORD_CHANGE_REQUIRED' }) };
  }
  if (perm && !can(admin.role, perm)) {
    return { response: adminFail(403, 'Your role does not allow this action.', { code: 'FORBIDDEN' }) };
  }
  return { admin };
}

export const migrationRequired = () =>
  adminFail(503, 'The admin tables are missing. Run supabase/migrations/07_admin_panel.sql in the Supabase SQL editor.', {
    code: 'MIGRATION_REQUIRED',
  });

/** Map thrown errors in admin routes to JSON responses. */
export function adminRouteError(e: unknown, label: string): NextResponse {
  if (isMissingSchema(e) || (e as any)?.code === '42703' || (e as any)?.code === '42P01') return migrationRequired();
  if (e instanceof ValidationError) return adminFail(400, e.message, { field: e.field });
  console.error(`[admin ${label}]`, e);
  return adminFail(500, 'Server error');
}

export function clientIp(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim();
}

// -------------------------------------------------------------------
// Audit log
// -------------------------------------------------------------------
export async function audit(
  admin: Pick<DbAdmin, 'id' | 'email'> | null,
  action: string,
  target: { type?: string; id?: string } = {},
  details: Record<string, unknown> | null = null,
  req?: NextRequest
): Promise<void> {
  const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    id: crypto.randomUUID(),
    admin_id: admin?.id ?? null,
    admin_email: admin?.email ?? null,
    action,
    target_type: target.type ?? null,
    target_id: target.id ?? null,
    details,
    ip: req ? clientIp(req) : null,
    created_at: nowIso(),
  });
  // Never fail the action because logging failed – but make it visible.
  if (error) console.error('[admin audit]', action, error.message);
}

// -------------------------------------------------------------------
// Simple in-memory rate limiter (per server instance)
// -------------------------------------------------------------------
const buckets = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return hits.length > max;
}
