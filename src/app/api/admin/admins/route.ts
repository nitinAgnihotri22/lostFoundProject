// Admin accounts (super admin only)
// GET  /api/admin/admins – every admin account.
// POST /api/admin/admins – create a sub admin: { name, email, password }.
//   The new admin must change this password at first sign-in.
import { NextRequest, NextResponse } from 'next/server';
import {
  adminFail, adminRouteError, audit, findAdminByEmail, insertAdmin, listAdmins, requireAdmin, toAdminProfile,
} from '@/lib/admin/server';
import { passwordProblem } from '@/lib/admin/permissions';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'admins.manage');
  if (auth.response) return auth.response;
  try {
    const admins = await listAdmins();
    const names = new Map(admins.map((a) => [a.id, a.name]));
    const data = admins.map((a) => ({ ...toAdminProfile(a), createdByName: a.created_by ? names.get(a.created_by) ?? null : null, locked: !!a.locked_until && new Date(a.locked_until).getTime() > Date.now() }));
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return adminRouteError(e, 'admins GET');
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'admins.manage');
  if (auth.response) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (name.length < 2 || name.length > 100) return adminFail(400, 'Name must be 2–100 characters.', { field: 'name' });
    if (!EMAIL_RE.test(email)) return adminFail(400, 'Enter a valid email address.', { field: 'email' });
    const problem = passwordProblem(password);
    if (problem) return adminFail(400, problem, { field: 'password' });
    if (await findAdminByEmail(email)) return adminFail(409, 'An admin with this email already exists.', { field: 'email' });

    const admin = await insertAdmin({ name, email, password, role: 'sub_admin', createdBy: auth.admin.id, mustChangePassword: true });
    await audit(auth.admin, 'admin.create', { type: 'admin', id: admin.id }, { email, role: 'sub_admin' }, req);
    return NextResponse.json({ success: true, data: toAdminProfile(admin) }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') return adminFail(409, 'An admin with this email already exists.', { field: 'email' });
    return adminRouteError(e, 'admins POST');
  }
}
