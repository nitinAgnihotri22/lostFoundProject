// Server-side guard for API routes: resolves the user from the token
// issued by /api/auth/login or /api/auth/register.
// Accepts `Authorization: Bearer <token>` or the `lf_token` cookie.
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { DbUser, findUserById } from '@/lib/users';

export type AuthResult =
  | { user: DbUser; response?: undefined }
  | { user?: undefined; response: NextResponse };

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const token = getTokenFromRequest(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Authentication required. Provide a valid Bearer token from /api/auth/login.' },
        { status: 401 }
      ),
    };
  }
  const user = await findUserById(payload.userId).catch(() => null);
  if (!user) {
    return {
      response: NextResponse.json(
        { success: false, error: 'User for this token no longer exists.' },
        { status: 401 }
      ),
    };
  }
  return { user };
}
