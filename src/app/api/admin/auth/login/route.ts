// POST /api/admin/auth/login – { email, password } → sets the lf_admin cookie (8h).
// Only accounts in admin_users can sign in; website accounts are rejected
// with the same generic message, so the endpoint doesn't reveal who exists.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminToken, hashPassword, setAdminCookie, verifyPassword } from '@/lib/auth';
import {
  adminFail, adminRouteError, audit, clientIp, findAdminByEmail, rateLimited, toAdminProfile, updateAdmin,
} from '@/lib/admin/server';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const INVALID = 'Invalid email or password.';
// Hash compared against when the email is unknown, so timing doesn't reveal valid emails.
const DUMMY_HASH = hashPassword('not-a-real-password-0');

export async function POST(req: NextRequest) {
  try {
    if (rateLimited(`admin-login:${clientIp(req)}`, 20, 15 * 60_000)) {
      return adminFail(429, 'Too many sign-in attempts. Try again in 15 minutes.', { code: 'RATE_LIMITED' });
    }
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) return adminFail(400, 'Email and password are required.');

    const admin = await findAdminByEmail(email);
    if (!admin) {
      verifyPassword(password, DUMMY_HASH);
      return adminFail(401, INVALID, { code: 'INVALID_CREDENTIALS' });
    }
    if (admin.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
      return adminFail(423, `Too many failed attempts. This account is locked until ${new Date(admin.locked_until).toLocaleTimeString('en-IN')}.`, { code: 'LOCKED' });
    }
    if (!verifyPassword(password, admin.password_hash)) {
      const failed = (admin.failed_attempts ?? 0) + 1;
      const lock = failed >= MAX_FAILED;
      await updateAdmin(admin.id, {
        failed_attempts: lock ? 0 : failed,
        locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
      });
      if (lock) await audit(admin, 'admin.locked', { type: 'admin', id: admin.id }, { failedAttempts: failed }, req);
      return adminFail(401, INVALID, { code: 'INVALID_CREDENTIALS' });
    }
    if (admin.status !== 'active') {
      return adminFail(403, 'This admin account has been disabled.', { code: 'ADMIN_DISABLED' });
    }

    const updated = await updateAdmin(admin.id, { failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() });
    await audit(updated, 'admin.login', { type: 'admin', id: admin.id }, null, req);
    const token = createAdminToken(updated.id, updated.session_version);
    return setAdminCookie(NextResponse.json({ success: true, data: toAdminProfile(updated) }), token);
  } catch (e) {
    return adminRouteError(e, 'auth/login');
  }
}
