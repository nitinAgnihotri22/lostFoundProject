// POST /api/auth/phone/complete – finish signing up a new phone number.
// Body: { signupToken, name, email? }   (signupToken from POST /api/auth/phone)
//   201 { token, user }   – account created and signed in
//   409 EMAIL_LINKED      – that email already belongs to another account
//   401 SIGNUP_EXPIRED    – ticket missing/expired → verify the phone again
import { NextRequest, NextResponse } from 'next/server';
import { verifyPhoneSignupToken } from '@/lib/auth';
import { createUser, findUserByEmail, findUserByVerifiedPhone, isDisabled, touchLastLogin } from '@/lib/users';
import { clientIp, disabledResponse, phoneRateLimited, signedIn } from '../shared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const emailLinked = () =>
  NextResponse.json(
    { error: 'This email is linked with another account.', code: 'EMAIL_LINKED', field: 'email' },
    { status: 409 }
  );

export async function POST(req: NextRequest) {
  try {
    if (phoneRateLimited(`phone-complete:${clientIp(req)}`)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again in a few minutes.', code: 'RATE_LIMITED' }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const ticket = typeof body.signupToken === 'string' ? verifyPhoneSignupToken(body.signupToken) : null;
    if (!ticket) {
      return NextResponse.json({ error: 'Your verification expired. Please verify your phone again.', code: 'SIGNUP_EXPIRED' }, { status: 401 });
    }
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: 'Please enter your name (2–100 characters).', field: 'name' }, { status: 400 });
    }
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.', field: 'email' }, { status: 400 });
    }

    // Created meanwhile (double submit / another tab) → just sign in.
    const existing = await findUserByVerifiedPhone(ticket.phone);
    if (existing) {
      if (isDisabled(existing)) return disabledResponse();
      return signedIn(await touchLastLogin(existing.id));
    }
    if (email && (await findUserByEmail(email))) return emailLinked();

    const user = await createUser({
      name,
      email: email || null,
      phone: ticket.phone,
      phoneE164: ticket.phone,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      roleSource: 'phone',
      roleType: 'phone',
    });
    return signedIn(user, 201);
  } catch (e: any) {
    if (e?.code === '23505') {
      // Unique violation: email taken (race) or the phone was registered concurrently.
      if (String(e?.message ?? '').includes('phone')) {
        return NextResponse.json({ error: 'This phone number already has an account. Please sign in again.', code: 'PHONE_EXISTS' }, { status: 409 });
      }
      return emailLinked();
    }
    console.error('[auth/phone/complete]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
