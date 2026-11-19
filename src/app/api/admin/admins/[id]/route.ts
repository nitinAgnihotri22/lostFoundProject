// PATCH /api/admin/admins/{id} (super admin only)
//   { action: 'disable' } | { action: 'enable' } | { action: 'reset_password', password } | { action: 'unlock' }
//   | { action: 'set_role', role: 'sub_admin' | 'checker' }
// Disabling or resetting a password ends that admin's sessions immediately.
// Super admin accounts and your own account can't be changed here (use Account for yourself).
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import {
  adminFail, adminRouteError, audit, bumpSessionVersion, findAdminById, requireAdmin, toAdminProfile, updateAdmin,
} from '@/lib/admin/server';
import { ASSIGNABLE_ROLES, passwordProblem } from '@/lib/admin/permissions';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req, 'admins.manage');
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const target = await findAdminById(id);
    if (!target) return adminFail(404, 'Admin not found.');
    if (target.id === auth.admin.id) return adminFail(400, 'Use the Account page to change your own account.');
    if (target.role === 'super_admin') return adminFail(403, 'Super admin accounts can’t be changed from here.');

    const body = await req.json().catch(() => ({}));
    let updated;
    switch (body.action) {
      case 'disable':
        updated = await bumpSessionVersion(target, { status: 'disabled' });
        break;
      case 'enable':
        updated = await updateAdmin(id, { status: 'active', failed_attempts: 0, locked_until: null });
        break;
      case 'set_role': {
        if (!ASSIGNABLE_ROLES.includes(body.role)) return adminFail(400, 'role must be "sub_admin" or "checker".', { field: 'role' });
        if (body.role === target.role) return adminFail(409, 'They already have this role.');
        // New permissions apply from their next request; no need to end sessions.
        updated = await updateAdmin(id, { role: body.role });
        break;
      }
      case 'unlock':
        updated = await updateAdmin(id, { failed_attempts: 0, locked_until: null });
        break;
      case 'reset_password': {
        const password = typeof body.password === 'string' ? body.password : '';
        const problem = passwordProblem(password);
        if (problem) return adminFail(400, problem, { field: 'password' });
        updated = await bumpSessionVersion(target, {
          password_hash: hashPassword(password),
          must_change_password: true,
          failed_attempts: 0,
          locked_until: null,
        });
        break;
      }
      default:
        return adminFail(400, 'Unknown action.');
    }
    await audit(auth.admin, `admin.${body.action}`, { type: 'admin', id }, { email: target.email, ...(body.action === 'set_role' ? { from: target.role, to: body.role } : {}) }, req);
    return NextResponse.json({ success: true, data: toAdminProfile(updated) });
  } catch (e) {
    return adminRouteError(e, 'admins/[id] PATCH');
  }
}
