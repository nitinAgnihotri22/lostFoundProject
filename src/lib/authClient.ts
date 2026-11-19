// Browser helpers for the /api/auth/* endpoints.
import { User } from '@/types';
import { trackRequest } from '@/lib/loading';

export class AuthError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

// Every API call goes through here and shows the global loader.
function call(
  path: string,
  init: RequestInit | undefined,
  loadingMessage: string
): Promise<{ token?: string; user: User }> {
  return trackRequest(() => rawCall(path, init), loadingMessage);
}

async function rawCall(path: string, init?: RequestInit): Promise<{ token?: string; user: User }> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AuthError(data.error || 'Request failed', res.status, data.code);
  return data;
}

const post = (path: string, body: unknown, loadingMessage: string) =>
  call(path, { method: 'POST', body: JSON.stringify(body) }, loadingMessage);

const SIGNING_IN = 'loading.signingIn';
const CREATING = 'loading.creatingAccount';

/**
 * After the Google OAuth callback: log in if the account exists,
 * otherwise register it (role_source=google, role_type=social).
 */
export function loginOrRegisterWithGoogle(accessToken: string): Promise<User> {
  // Outer tracker keeps the loader up across the login → register hand-off.
  return trackRequest(async () => {
    try {
      return (await post('/api/auth/login', { provider: 'google', accessToken }, SIGNING_IN)).user;
    } catch (e) {
      if (!(e instanceof AuthError) || e.code !== 'USER_NOT_FOUND') throw e;
    }
    try {
      return (await post('/api/auth/register', { provider: 'google', accessToken }, CREATING)).user;
    } catch (e) {
      // Created concurrently (e.g. another tab) – just log in.
      if (e instanceof AuthError && e.code === 'USER_EXISTS') {
        return (await post('/api/auth/login', { provider: 'google', accessToken }, SIGNING_IN)).user;
      }
      throw e;
    }
  }, 'loading.googleSignIn');
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  return (await post('/api/auth/login', { provider: 'email', email, password }, SIGNING_IN)).user;
}

export async function registerWithEmail(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<User> {
  return (await post('/api/auth/register', { provider: 'email', ...input }, CREATING)).user;
}

/** Returns the logged-in user if the 24h token is still valid, else null. */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return (await call('/api/auth/me', undefined, 'loading.checkingSession')).user;
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) return null;
    throw e;
  }
}

// Not wrapped in the global loader – the logout popup shows its own progress.
export async function logoutRequest(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
}

// -------------------------------------------------------------------
// Phone OTP
// -------------------------------------------------------------------
export type PhoneSignInResult =
  | { kind: 'signed_in'; user: User }
  | { kind: 'needs_profile'; signupToken: string; phone: string };

/** After Supabase verifyOtp: sign in, or learn that this number is new. */
export function signInWithVerifiedPhone(accessToken: string): Promise<PhoneSignInResult> {
  return trackRequest(async () => {
    const res = await fetch('/api/auth/phone', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AuthError(data.error || 'Request failed', res.status, data.code);
    return data.needsProfile
      ? { kind: 'needs_profile' as const, signupToken: String(data.signupToken), phone: String(data.phone) }
      : { kind: 'signed_in' as const, user: data.user as User };
  }, SIGNING_IN);
}

/** New phone number: create the account with a name and optional email. */
export async function completePhoneSignup(input: { signupToken: string; name: string; email?: string }): Promise<User> {
  return (await post('/api/auth/phone/complete', input, CREATING)).user;
}
