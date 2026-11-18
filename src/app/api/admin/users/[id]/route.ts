// GET   /api/admin/users/{id} – one website user.
// PATCH /api/admin/users/{id} – { action: 'disable', reason, hidePosts?: boolean } | { action: 'enable' }
//   A disabled user can't sign in, and any session they already have stops working on the next request.
import { NextRequest, NextResponse } from 'next/server';
import { adminFail, adminRouteError, audit, requireAdmin } from '@/lib/admin/server';
import { getWebUser, setWebUserStatus } from '@/lib/admin/data';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req, 'users.view');
  if (auth.response) return auth.response;
  try {
    const user = await getWebUser((await params).id);
    if (!user) return adminFail(404, 'User not found.');
    return NextResponse.json({ success: true, data: user });
  } catch (e) {
    return adminRouteError(e, 'users/[id] GET');
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req, 'users.moderate');
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const user = await getWebUser(id);
    if (!user) return adminFail(404, 'User not found.');
    const body = await req.json().catch(() => ({}));

    if (body.action === 'disable') {
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
      if (!reason) return adminFail(400, 'Give a reason for disabling this account.', { field: 'reason' });
      if (user.status === 'disabled') return adminFail(409, 'This user is already disabled.');
      const { postsChanged } = await setWebUserStatus(id, true, reason, auth.admin, body.hidePosts !== false);
      await audit(auth.admin, 'user.disable', { type: 'user', id }, { email: user.email, reason, postsHidden: postsChanged }, req);
      return NextResponse.json({ success: true, data: { user: await getWebUser(id), postsChanged } });
    }
    if (body.action === 'enable') {
      if (user.status === 'active') return adminFail(409, 'This user is already active.');
      const { postsChanged } = await setWebUserStatus(id, false, null, auth.admin, false);
      await audit(auth.admin, 'user.enable', { type: 'user', id }, { email: user.email, postsRestored: postsChanged }, req);
      return NextResponse.json({ success: true, data: { user: await getWebUser(id), postsChanged } });
    }
    return adminFail(400, 'action must be "disable" or "enable".');
  } catch (e) {
    return adminRouteError(e, 'users/[id] PATCH');
  }
}
