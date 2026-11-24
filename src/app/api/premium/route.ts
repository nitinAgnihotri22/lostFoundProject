// GET    /api/premium – the caller's plan and limits.
// POST   /api/premium – start Premium (free during launch; no card, no end date).
// DELETE /api/premium – go back to Free. Saved searches above the Free limit are paused.
import { after, NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { routeError } from '@/lib/itemView';
import { activatePremium, cancelPremium, getPlan } from '@/lib/billing';
import { PAYMENTS_ENABLED, PLAN_LIMITS } from '@/lib/plans';
import { recordServerEvent } from '@/lib/analytics';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    return NextResponse.json({ success: true, data: { ...(await getPlan(auth.user.id)), paymentsEnabled: PAYMENTS_ENABLED } });
  } catch (e) {
    return routeError(e, 'premium GET');
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const before = await getPlan(auth.user.id);
    const plan = await activatePremium(auth.user.id);
    if (before.plan !== 'premium') after(() => recordServerEvent(req, 'premium_started', { userId: auth.user.id, variant: 'none' }));
    return NextResponse.json({ success: true, data: plan });
  } catch (e) {
    return routeError(e, 'premium POST');
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const plan = await cancelPremium(auth.user.id);
    // Keep the oldest searches within the Free limit active; pause the rest; cap radius.
    const { data } = await supabaseAdmin.from('saved_searches').select('id, radius_km').eq('user_id', auth.user.id).order('created_at', { ascending: true });
    const extra = (data ?? []).slice(PLAN_LIMITS.free.savedSearches).map((r: any) => r.id);
    if (extra.length) await supabaseAdmin.from('saved_searches').update({ active: false }).in('id', extra);
    await supabaseAdmin.from('saved_searches').update({ radius_km: PLAN_LIMITS.free.maxAlertRadiusKm }).eq('user_id', auth.user.id).gt('radius_km', PLAN_LIMITS.free.maxAlertRadiusKm);
    return NextResponse.json({ success: true, data: plan });
  } catch (e) {
    return routeError(e, 'premium DELETE');
  }
}
