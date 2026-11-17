// POST /api/contact – store a Contact Us message (see supabase/migrations/06_contact_messages.sql).
import { NextRequest, NextResponse } from 'next/server';
import { CONTACT_SUBJECTS, insertContactMessage, isMissingSchema } from '@/lib/db';
import { fail, optionalAuth } from '@/lib/session';
import { readJson, routeError } from '@/lib/itemView';
import { requireEnum, requireText, str, ValidationError } from '@/lib/validation';
import { DEFAULT_LANG, LANG_COOKIE, isLang } from '@/i18n/config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

// Simple per-IP limit. In-memory, so it resets on deploy and is per server instance –
// enough to stop a script hammering the form, not a substitute for a WAF.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);

    // Honeypot: real users never see or fill the "website" field. Pretend success so bots move on.
    if (str(body.website)) {
      return NextResponse.json({ success: true, data: { reference: 'LF-RECEIVED' } }, { status: 201 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    if (rateLimited(ip)) {
      return fail(429, 'Too many messages. Please wait a few minutes and try again.', { code: 'RATE_LIMITED' });
    }

    const name = requireText(body.name, 'name', 2, 100);
    const email = requireText(body.email, 'email', 5, 254).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new ValidationError('Please enter a valid email address.', 'email');
    const phone = str(body.phone);
    if (phone && !PHONE_RE.test(phone)) throw new ValidationError('Please enter a valid phone number.', 'phone');
    const subject = requireEnum(body.subject, CONTACT_SUBJECTS, 'subject');
    const message = requireText(body.message, 'message', 10, 2000);
    if (body.consent !== true) throw new ValidationError('Consent to the Privacy Policy is required.', 'consent');

    const langCookie = request.cookies.get(LANG_COOKIE)?.value;
    const user = await optionalAuth(request);

    const { reference } = await insertContactMessage({
      name,
      email,
      phone: phone || undefined,
      subject,
      message,
      lang: isLang(langCookie) ? langCookie : DEFAULT_LANG,
      userId: user?.id ?? null,
      pageUrl: request.headers.get('referer') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({ success: true, data: { reference } }, { status: 201 });
  } catch (e) {
    if (isMissingSchema(e)) {
      console.error('[contact POST] contact_messages table missing:', (e as { message?: string }).message);
      return fail(503, 'The contact form is not set up yet. Run supabase/migrations/06_contact_messages.sql in the Supabase SQL editor.', {
        code: 'MIGRATION_REQUIRED',
      });
    }
    return routeError(e, 'contact POST');
  }
}
