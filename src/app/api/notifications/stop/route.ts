// GET /api/notifications/stop?t=… – one-tap "Stop nearby alerts" / "Stop match emails"
// from a push notification or email. Works without signing in (signed link).
import { NextRequest, NextResponse } from 'next/server';
import { savePrefs, verifyStopToken } from '@/lib/notify';

export async function GET(req: NextRequest) {
  const t = verifyStopToken(req.nextUrl.searchParams.get('t') ?? '');
  const to = new URL('/alerts', req.nextUrl.origin);
  if (!t) {
    to.searchParams.set('stopped', 'invalid');
    return NextResponse.redirect(to);
  }
  try {
    await savePrefs(t.userId, t.kind === 'nearby' ? { nearbyAlerts: false } : { matchEmail: false });
    to.searchParams.set('stopped', t.kind);
  } catch (e) {
    console.error('[notifications/stop]', e);
    to.searchParams.set('stopped', 'error');
  }
  return NextResponse.redirect(to);
}

// The service worker's "Stop" button calls this in the background.
export const POST = GET;
