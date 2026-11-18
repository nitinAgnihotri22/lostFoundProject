// Own admin account
// PATCH /api/admin/account  { name?, currentPassword?, newPassword? }
//   Changing the password ends every other session and issues a fresh cookie.
// POST  /api/admin/account  { action: 'signout_all' } – end every session, including this one.
import { NextRequest, NextResponse } from 'next/server';
import { clearAdminCookie, createAdminToken, hashPassword, setAdminCookie, verifyPassword } from '@/lib/auth';
import { adminFail, adminRouteError, audit, bumpSessionVersion, requireAdmin, toAdminProfile, updateAdmin } from '@/lib/admin/server';
import { passwordProblem } from '@/lib/admin/permissions';

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, null);
  if (auth.response) return auth.response;
  let { admin } = auth;
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    if (name !== undefined) {
      if (name.length < 2 || name.length > 100) return adminFail(400, 'Name must be 2–100 characters.', { field: 'name' });
      admin = await updateAdmin(admin.id, { name });
    }

    if (body.newPassword !== undefined) {
      const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const next = typeof body.newPassword === 'string' ? body.newPassword : '';
      if (!verifyPassword(current, admin.password_hash)) {
        return adminFail(400, 'Current password is incorrect.', { field: 'currentPassword' });
      }
      const problem = passwordProblem(next);
      if (problem) return adminFail(400, problem, { field: 'newPassword' });
      if (verifyPassword(next, admin.password_hash)) {
        return adminFail(400, 'Choose a password different from the current one.', { field: 'newPassword' });
      }
      admin = await bumpSessionVersion(admin, { password_hash: hashPassword(next), must_change_password: false });
      await audit(admin, 'account.password_change', { type: 'admin', id: admin.id }, null, req);
      const token = createAdminToken(admin.id, admin.session_version);
      return setAdminCookie(NextResponse.json({ success: true, data: toAdminProfile(admin) }), token);
    }

    if (name !== undefined) await audit(admin, 'account.update', { type: 'admin', id: admin.id }, { name }, req);
    return NextResponse.json({ success: true, data: toAdminProfile(admin) });
  } catch (e) {
    return adminRouteError(e, 'account PATCH');
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, null);
  if (auth.response) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action !== 'signout_all') return adminFail(400, 'Unknown action.');
    await bumpSessionVersion(auth.admin);
    await audit(auth.admin, 'account.signout_all', { type: 'admin', id: auth.admin.id }, null, req);
    return clearAdminCookie(NextResponse.json({ success: true }));
  } catch (e) {
    return adminRouteError(e, 'account POST');
  }
}
