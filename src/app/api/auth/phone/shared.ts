// Helpers shared by the phone sign-in routes.
import { NextResponse, type NextRequest } from 'next/server';
import { createToken, setAuthCookie } from '@/lib/auth';
import { ACCOUNT_DISABLED_MESSAGE, DbUser, toPublicUser } from '@/lib/users';

export function signedIn(user: DbUser, status = 200) {
  const token = createToken(user.id);
  return setAuthCookie(NextResponse.json({ token, user: toPublicUser(user) }, { status }), token);
}

export const disabledResponse = () =>
  NextResponse.json({ error: ACCOUNT_DISABLED_MESSAGE, code: 'ACCOUNT_DISABLED' }, { status: 403 });


const hits = new Map<string, number[]>();

/** 20 requests per 15 minutes per key. */
export function phoneRateLimited(key: string, max = 20, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

export const clientIp = (req: NextRequest) =>
  (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim();
