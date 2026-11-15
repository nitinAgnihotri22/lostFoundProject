// POST /api/auth/register
// ---------------------------------------------------------------
// Body (Google):  { provider: 'google', accessToken: string }
//   → role_source = 'google', role_type = 'social', no password
// Body (Email):   { provider: 'email', name, email, password, phone? }
//   → role_source = 'normal_register', role_type = 'email'
//
// 201 → { token, user }   (token valid 24h, also set as httpOnly cookie)
// 409 → { code: 'USER_EXISTS' } – caller should hit /api/auth/login
import { NextRequest, NextResponse } from 'next/server';
import { createToken, hashPassword, setAuthCookie } from '@/lib/auth';
import {
  createUser,
  findUserByEmail,
  findUserByProviderId,
  toPublicUser,
  verifyGoogleAccessToken,
  DbUser,
} from '@/lib/users';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function created(user: DbUser) {
  const token = createToken(user.id);
  return setAuthCookie(
    NextResponse.json({ token, user: toPublicUser(user) }, { status: 201 }),
    token
  );
}

const exists = () =>
  NextResponse.json({ error: 'Account already exists', code: 'USER_EXISTS' }, { status: 409 });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const provider = body.provider ?? 'email';

    if (provider === 'google') {
      if (!body.accessToken) {
        return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
      }
      const identity = await verifyGoogleAccessToken(body.accessToken);
      if (!identity) {
        return NextResponse.json({ error: 'Invalid Google session' }, { status: 401 });
      }
      if (
        (await findUserByProviderId(identity.providerId)) ||
        (await findUserByEmail(identity.email))
      ) {
        return exists();
      }
      const user = await createUser({
        name: identity.name,
        email: identity.email,
        avatar: identity.avatar,
        roleSource: 'google',
        roleType: 'social',
        authProviderId: identity.providerId,
      });
      return created(user);
    }

    if (provider === 'email') {
      const name = String(body.name ?? '').trim();
      const email = String(body.email ?? '').trim();
      const password = String(body.password ?? '');
      const phone = body.phone ? String(body.phone).trim() : null;

      if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
      }
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }
      if (await findUserByEmail(email)) return exists();

      const user = await createUser({
        name,
        email,
        phone,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        roleSource: 'normal_register',
        roleType: 'email',
        passwordHash: hashPassword(password),
      });
      return created(user);
    }

    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  } catch (e: any) {
    // Unique-violation race (two concurrent registers for the same email)
    if (e?.code === '23505') return exists();
    console.error('[auth/register]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
