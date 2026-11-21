// POST /api/analytics – browsing events from the website (sendBeacon or fetch).
// Body: { v: visitorId, e: [{ n: name, p?: path, x?: props, a?: adVariant }] }
// The browser only calls this when the visitor allowed analytics cookies.
// Always answers 204 so a blocked or broken event never shows an error.
import { NextRequest, NextResponse } from 'next/server';
import { recordEvents } from '@/lib/analytics';
import { clientIp, phoneRateLimited } from '@/app/api/auth/phone/shared';
import { CLIENT_EVENTS, type AdVariant, type ClientEvent } from '@/lib/monetization';
import { CONSENT_COOKIE } from '@/lib/consent';

const MAX_EVENTS = 20;
const VARIANTS: AdVariant[] = ['ads', 'holdout', 'none'];
const done = () => new NextResponse(null, { status: 204 });

function cleanProps(x: unknown): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!x || typeof x !== 'object' || Array.isArray(x)) return out;
  for (const [k, v] of Object.entries(x).slice(0, 8)) {
    if (!/^[a-z_]{1,30}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 100);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean' || v === null) out[k] = v;
  }
  return out;
}

export async function POST(req: NextRequest) {
  // Only from our own pages.
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) return done();
  // Double-check consent on the server too.
  try {
    const c = JSON.parse(decodeURIComponent(req.cookies.get(CONSENT_COOKIE)?.value ?? ''));
    if (!c?.analytics) return done();
  } catch {
    return done();
  }
  if (phoneRateLimited(`analytics:${clientIp(req)}`, 600, 10 * 60_000)) return done();

  let body: any;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return done();
  }
  const visitorId = typeof body?.v === 'string' && /^[a-z0-9-]{8,40}$/i.test(body.v) ? body.v : null;
  const events = Array.isArray(body?.e) ? body.e.slice(0, MAX_EVENTS) : [];
  const rows = events
    .filter((e: any) => CLIENT_EVENTS.includes(e?.n))
    .map((e: any) => ({
      name: e.n as ClientEvent,
      visitorId,
      path: typeof e.p === 'string' ? e.p : null,
      variant: VARIANTS.includes(e.a) ? (e.a as AdVariant) : null,
      props: cleanProps(e.x),
    }));
  await recordEvents(rows);
  return done();
}
