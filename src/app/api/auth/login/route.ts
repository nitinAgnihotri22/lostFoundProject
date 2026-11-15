// POST /api/auth/login
// ---------------------------------------------------------------
// Body (Google):  { provider: 'google', accessToken: string }
// Body (Email):   { provider: 'email', email: string, password: string }
//
// 200 → { token, user }   (token valid 24h, also set as httpOnly cookie)
// 404 → { code: 'USER_NOT_FOUND' }  – caller should hit /api/auth/register
// 401 → invalid credentials / invalid Google token
import { NextRequest, NextResponse } from 'next/server';
import { createToken, setAuthCookie, verifyPassword } from '@/lib/auth';
import {
  findUserByEmail,
  findUserByProviderId,
  toPublicUser,
  touchLastLogin,
  verifyGoogleAccessToken,
} from '@/lib/users';

function success(user: Parameters<typeof toPublicUser>[0]) {
  const token = createToken(user.id);
  return setAuthCookie(NextResponse.json({ token, user: toPublicUser(user) }), token);
}

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

      let user = await findUserByProviderId(identity.providerId);
      if (!user) {
        // Same (Google-verified) email registered earlier – link the Google identity.
        const byEmail = await findUserByEmail(identity.email);
        if (byEmail) {
          user = await touchLastLogin(byEmail.id, {
            auth_provider_id: identity.providerId,
            avatar: byEmail.avatar ?? identity.avatar,
          });
          return success(user);
        }
        return NextResponse.json(
          { error: 'User not found', code: 'USER_NOT_FOUND' },
          { status: 404 }
        );
      }
      return success(await touchLastLogin(user.id));
    }

    if (provider === 'email') {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
      }
      const user = await findUserByEmail(email);
      if (!user) {
        return NextResponse.json(
          { error: 'No account found for this email', code: 'USER_NOT_FOUND' },
          { status: 404 }
        );
      }
      if (user.role_type === 'social' || !user.password_hash) {
        return NextResponse.json(
          { error: 'This account uses Google sign-in. Please continue with Google.' },
          { status: 401 }
        );
      }
      if (!verifyPassword(password, user.password_hash)) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }
      return success(await touchLastLogin(user.id));
    }

    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  } catch (e) {
    console.error('[auth/login]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
