// GET  /api/admin/users – website users. ?search= &status=active|disabled &page= &pageSize=
// POST /api/admin/users – create a website user (super admin): { name, email, password, phone? }
//   The account signs in on the website with email + password like any other user.
import { NextRequest, NextResponse } from 'next/server';
import { adminFail, adminRouteError, audit, requireAdmin } from '@/lib/admin/server';
import { getWebUser, listWebUsers } from '@/lib/admin/data';
import { createUser, findUserByEmail, supabaseAdmin } from '@/lib/users';
import { hashPassword } from '@/lib/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'users.view');
  if (auth.response) return auth.response;
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get('status');
    const data = await listWebUsers({
      search: sp.get('search') || undefined,
      status: status === 'active' || status === 'disabled' ? status : undefined,
      page: Number(sp.get('page')) || 1,
      pageSize: Number(sp.get('pageSize')) || 25,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return adminRouteError(e, 'users GET');
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'users.create');
  if (auth.response) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const phone = String(body.phone ?? '').trim() || null;
    if (name.length < 2 || name.length > 100) return adminFail(400, 'Name must be 2–100 characters.', { field: 'name' });
    if (!EMAIL_RE.test(email)) return adminFail(400, 'Enter a valid email address.', { field: 'email' });
    if (password.length < 8 || password.length > 200) return adminFail(400, 'Password must be at least 8 characters.', { field: 'password' });
    if (phone && !/^\+?[0-9\s\-()]{7,20}$/.test(phone)) return adminFail(400, 'Enter a valid phone number.', { field: 'phone' });
    if (await findUserByEmail(email)) return adminFail(409, 'A website account with this email already exists.', { field: 'email', code: 'USER_EXISTS' });

    const user = await createUser({
      name,
      email,
      phone,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      roleSource: 'normal_register',
      roleType: 'email',
      passwordHash: hashPassword(password),
    });
    // createUser stamps a login time – this account hasn't signed in yet.
    await supabaseAdmin.from('users').update({ created_by_admin: auth.admin.id, last_login_at: null }).eq('id', user.id);
    await audit(auth.admin, 'user.create', { type: 'user', id: user.id }, { email }, req);
    return NextResponse.json({ success: true, data: await getWebUser(user.id) }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') return adminFail(409, 'A website account with this email already exists.', { field: 'email', code: 'USER_EXISTS' });
    return adminRouteError(e, 'users POST');
  }
}
