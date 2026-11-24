// GET /api/auth/me – returns the user for a valid (non-expired) token.
import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie, getTokenFromRequest, verifyToken } from '@/lib/auth';
import { ACCOUNT_DISABLED_MESSAGE, findUserById, isDisabled, toPublicUser } from '@/lib/users';
import { getPlan } from '@/lib/billing';

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return clearAuthCookie(NextResponse.json({ error: 'Not authenticated' }, { status: 401 }));
  }
  try {
    const user = await findUserById(payload.userId);
    if (!user) {
      return clearAuthCookie(NextResponse.json({ error: 'User not found' }, { status: 401 }));
    }
    if (isDisabled(user)) {
      return clearAuthCookie(
        NextResponse.json({ error: ACCOUNT_DISABLED_MESSAGE, code: 'ACCOUNT_DISABLED' }, { status: 401 })
      );
    }
    // Plan decides e.g. whether ads are shown. Free if the tables aren't there yet.
    const plan = await getPlan(user.id).then((p) => p.plan).catch(() => 'free' as const);
    return NextResponse.json({ user: { ...toPublicUser(user), plan }, expiresAt: payload.exp * 1000 });
  } catch (e) {
    console.error('[auth/me]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
