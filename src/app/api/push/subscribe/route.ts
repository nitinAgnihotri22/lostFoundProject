// POST   /api/push/subscribe { endpoint, keys: { p256dh, auth } } – save this browser for push alerts.
// DELETE /api/push/subscribe { endpoint } – forget it.
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { fail, requireAuth } from '@/lib/session';
import { readJson, routeError } from '@/lib/itemView';

const B64U = /^[A-Za-z0-9_-]+=*$/;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const b = await readJson(req);
    const endpoint = String(b.endpoint ?? '');
    const p256dh = String(b.keys?.p256dh ?? '');
    const authKey = String(b.keys?.auth ?? '');
    if (!/^https:\/\/[^\s]{10,1000}$/.test(endpoint) || !B64U.test(p256dh) || !B64U.test(authKey) || p256dh.length > 200 || authKey.length > 100) {
      return fail(400, 'Invalid push subscription.');
    }
    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      {
        id: crypto.randomUUID(),
        user_id: auth.user.id,
        endpoint,
        p256dh,
        auth: authKey,
        user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300),
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );
    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    return routeError(e, 'push subscribe');
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const b = await readJson(req);
    const { error } = await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', auth.user.id).eq('endpoint', String(b.endpoint ?? ''));
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return routeError(e, 'push unsubscribe');
  }
}
