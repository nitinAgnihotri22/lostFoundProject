// Server-side auth guards for API routes.
// Resolves the user from the token issued by /api/auth/login or /api/auth/register,
// sent as `Authorization: Bearer <token>` or the `lf_token` cookie.
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { ACCOUNT_DISABLED_MESSAGE, DbUser, findUserById, isDisabled } from '@/lib/users';

export type AuthResult =
  | { user: DbUser; response?: undefined }
  | { user?: undefined; response: NextResponse };

export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ success: false, error, ...extra }, { status });

/** Resolve the user if a valid token is present; `null` otherwise (never errors). */
export async function optionalAuth(req: NextRequest): Promise<DbUser | null> {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return null;
  const user = await findUserById(payload.userId).catch(() => null);
  return user && !isDisabled(user) ? user : null;
}

/** Require a valid token; returns a ready-made 401 response when missing/invalid. */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return {
      response: fail(401, 'Authentication required. Provide a valid Bearer token from /api/auth/login.', {
        code: 'UNAUTHENTICATED',
      }),
    };
  }
  const user = await findUserById(payload.userId).catch(() => null);
  if (!user) {
    return { response: fail(401, 'User for this token no longer exists.', { code: 'UNAUTHENTICATED' }) };
  }
  if (isDisabled(user)) {
    // 401 so the website's existing "session ended" handling signs the user out.
    return { response: fail(401, ACCOUNT_DISABLED_MESSAGE, { code: 'ACCOUNT_DISABLED' }) };
  }
  return { user };
}
