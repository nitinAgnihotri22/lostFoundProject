// GET /api/notifications/prefs – alert settings, push status and plan.
// PUT /api/notifications/prefs { nearbyAlerts?, nearbyDailyLimit?, area?: {lat,lng,label}|null,
//                                 matchEmail?, matchPush?, quietStart?, quietEnd? }
// The area is rounded to ~1 km before it is stored.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { fail, requireAuth } from '@/lib/session';
import { readJson, routeError } from '@/lib/itemView';
import { getPrefs, savePrefs } from '@/lib/notify';
import { pushConfigured } from '@/lib/webpush';
import { LANG_COOKIE, isLang } from '@/i18n/config';

const hour = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 23 ? (v as number) : undefined);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const [prefs, { count }] = await Promise.all([
      getPrefs(auth.user.id),
      supabaseAdmin.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', auth.user.id),
    ]);
    return NextResponse.json({ success: true, data: { prefs, pushDevices: count ?? 0, pushAvailable: pushConfigured(), hasEmail: !!auth.user.email } });
  } catch (e) {
    return routeError(e, 'prefs GET');
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const b = await readJson(req);
    const patch: Parameters<typeof savePrefs>[1] = {};
    if (typeof b.nearbyAlerts === 'boolean') patch.nearbyAlerts = b.nearbyAlerts;
    if (b.nearbyDailyLimit === 1 || b.nearbyDailyLimit === 2) patch.nearbyDailyLimit = b.nearbyDailyLimit;
    if (typeof b.matchEmail === 'boolean') patch.matchEmail = b.matchEmail;
    if (typeof b.matchPush === 'boolean') patch.matchPush = b.matchPush;
    if (hour(b.quietStart) !== undefined) patch.quietStart = hour(b.quietStart);
    if (hour(b.quietEnd) !== undefined) patch.quietEnd = hour(b.quietEnd);
    if (b.area === null) patch.area = null;
    else if (b.area && typeof b.area === 'object') {
      const lat = Number(b.area.lat);
      const lng = Number(b.area.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail(400, 'Invalid area.', { field: 'area' });
      patch.area = { lat, lng, label: String(b.area.label ?? '').trim() || 'My area' };
    }
    // Remember the language so push/email texts match the site.
    const lang = req.cookies.get(LANG_COOKIE)?.value;
    if (isLang(lang)) patch.lang = lang;
    const prefs = await savePrefs(auth.user.id, patch);
    return NextResponse.json({ success: true, data: { prefs } });
  } catch (e) {
    return routeError(e, 'prefs PUT');
  }
}
