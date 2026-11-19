// POST /api/auth/phone – sign in with a phone number verified by SMS OTP.
// ---------------------------------------------------------------
// The browser sends the code via Supabase (signInWithOtp / verifyOtp) and
// passes the resulting access token here. We read the verified phone from
// Supabase server-side, then:
//   200 { token, user }                         – account found → signed in (cookie set)
//   200 { needsProfile: true, signupToken, phone } – new number → ask for name/email,
//        then POST /api/auth/phone/complete (the ticket is valid 15 minutes)
//   401 invalid/expired OTP session · 403 ACCOUNT_DISABLED · 429 too many attempts
import { NextRequest, NextResponse } from 'next/server';
import { createPhoneSignupToken } from '@/lib/auth';
import {
  findUserByVerifiedPhone, findUsersByTypedPhone, isDisabled, setVerifiedPhone, touchLastLogin, verifyPhoneAccessToken,
} from '@/lib/users';
import { isMissingSchema } from '@/lib/db';
import { clientIp, disabledResponse, phoneRateLimited, signedIn } from './shared';

export async function POST(req: NextRequest) {
  try {
    if (phoneRateLimited(`phone:${clientIp(req)}`)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again in a few minutes.', code: 'RATE_LIMITED' }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    if (typeof body.accessToken !== 'string' || !body.accessToken) {
      return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
    }
    const identity = await verifyPhoneAccessToken(body.accessToken);
    if (!identity) {
      return NextResponse.json({ error: 'Phone verification failed or expired. Please request a new code.', code: 'INVALID_OTP_SESSION' }, { status: 401 });
    }

    // 1. An account that already verified this number.
    const verified = await findUserByVerifiedPhone(identity.phoneE164);
    if (verified) {
      if (isDisabled(verified)) return disabledResponse();
      return signedIn(await touchLastLogin(verified.id));
    }

    // 2. An older account that typed this number at sign-up (not verified yet).
    //    Only when exactly one account matches – otherwise it's ambiguous.
    const typed = await findUsersByTypedPhone(identity.phoneE164);
    if (typed.length === 1) {
      if (isDisabled(typed[0])) return disabledResponse();
      return signedIn(await setVerifiedPhone(typed[0].id, identity.phoneE164));
    }

    // 3. New number → the client asks for name + optional email next.
    return NextResponse.json({
      needsProfile: true,
      signupToken: createPhoneSignupToken(identity.phoneE164),
      phone: identity.phoneE164,
    });
  } catch (e) {
    if (isMissingSchema(e) || (e as any)?.code === '42703') {
      return NextResponse.json({ error: 'Phone sign-in is not set up yet (run supabase/migrations/09_phone_login.sql).', code: 'MIGRATION_REQUIRED' }, { status: 503 });
    }
    console.error('[auth/phone]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
