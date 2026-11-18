// Authentication utilities – token signing/verification & password hashing
// ------------------------------------------------------------------------
// Server-only. Uses Node's built-in `crypto`, so no extra dependencies.
//   - Tokens are HS256 JWTs signed with JWT_SECRET, valid for 24 hours.
//   - Passwords are hashed with scrypt + per-user random salt.

import crypto from 'crypto';
import { NextResponse } from 'next/server';

export const TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 hours
export const AUTH_COOKIE = 'lf_token';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is not set');
    }
    return 'dev-only-insecure-secret';
  }
  return secret;
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString('base64url');

export interface TokenPayload {
  userId: string;
  iat: number;
  exp: number;
}

/** Sign an HS256 JWT. `scope` selects the signing key, so tokens can't cross between website and admin. */
function signJwt(claims: Record<string, unknown>, ttlSeconds: number, scope: 'web' | 'admin'): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ ...claims, iat: now, exp: now + ttlSeconds }));
  const signature = crypto.createHmac('sha256', signingKey(scope)).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyJwt<T extends { exp: number }>(token: string, scope: 'web' | 'admin'): T | null {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    const expected = crypto.createHmac('sha256', signingKey(scope)).update(`${header}.${payload}`).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as T;
    if (typeof data.exp !== 'number' || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Website tokens keep the original key; admin tokens use a key derived from it. */
const signingKey = (scope: 'web' | 'admin') => (scope === 'web' ? getSecret() : `${getSecret()}::lostfound-admin`);

/** Create a JWT for the given user ID. Expires after 24 hours. */
export function createToken(userId: string): string {
  return signJwt({ userId }, TOKEN_TTL_SECONDS, 'web');
}

/** Verify a website JWT and return its payload, or `null` if invalid/expired. */
export function verifyToken(token: string): TokenPayload | null {
  const data = verifyJwt<TokenPayload>(token, 'web');
  return data && typeof data.userId === 'string' && data.userId ? data : null;
}

// -------------------------------------------------------------------
// Admin panel sessions (separate cookie, separate key, shorter life)
// -------------------------------------------------------------------
export const ADMIN_COOKIE = 'lf_admin';
export const ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export interface AdminTokenPayload {
  adminId: string;
  /** admin_users.session_version at sign-in; a bump invalidates the token. */
  sv: number;
  iat: number;
  exp: number;
}

export function createAdminToken(adminId: string, sessionVersion: number): string {
  return signJwt({ adminId, sv: sessionVersion }, ADMIN_TOKEN_TTL_SECONDS, 'admin');
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  const data = verifyJwt<AdminTokenPayload>(token, 'admin');
  return data && typeof data.adminId === 'string' && typeof data.sv === 'number' ? data : null;
}

export function setAdminCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_TOKEN_TTL_SECONDS,
  });
  return res;
}

export function clearAdminCookie(res: NextResponse): NextResponse {
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return res;
}

/** Read the token from the auth cookie or `Authorization: Bearer` header. */
export function getTokenFromRequest(req: Request & { cookies?: { get(name: string): { value: string } | undefined } }): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return req.cookies?.get(AUTH_COOKIE)?.value ?? null;
}

/** Attach the auth token as an httpOnly cookie (24h). */
export function setAuthCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_TTL_SECONDS,
  });
  return res;
}

export function clearAuthCookie(res: NextResponse): NextResponse {
  res.cookies.set(AUTH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

// -------------------------------------------------------------------
// Password hashing (scrypt)
// -------------------------------------------------------------------
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}
