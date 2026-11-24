// GET  /api/saved-searches – the caller's saved searches ("what I lost"), recent matches, plan and limits.
// POST /api/saved-searches { label, category?, keywords?, location: {lat,lng,address}, radiusKm, lostOn? }
//      Also checks items posted in the last 30 days, so matches can show straight away.
import crypto from 'crypto';
import { after, NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { fail, requireAuth } from '@/lib/session';
import { readJson, routeError } from '@/lib/itemView';
import { getPlan } from '@/lib/billing';
import { backfillMatches, listMatches, mapSearchRow } from '@/lib/matching';
import { recordServerEvent } from '@/lib/analytics';
import { searchInput } from './input';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const [{ data, error }, matches, plan] = await Promise.all([
      supabaseAdmin.from('saved_searches').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: true }),
      listMatches(auth.user.id),
      getPlan(auth.user.id),
    ]);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const m of matches) counts.set(m.savedSearchId, (counts.get(m.savedSearchId) ?? 0) + 1);
    return NextResponse.json({
      success: true,
      data: {
        searches: (data ?? []).map((r: any) => mapSearchRow(r, counts.get(String(r.id)) ?? 0)),
        matches,
        plan: plan.plan,
        limits: plan.limits,
        subscription: plan.subscription,
      },
    });
  } catch (e) {
    return routeError(e, 'saved-searches GET');
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const plan = await getPlan(auth.user.id);
    const { count } = await supabaseAdmin.from('saved_searches').select('id', { count: 'exact', head: true }).eq('user_id', auth.user.id);
    if ((count ?? 0) >= plan.limits.savedSearches) {
      return fail(403, `Your plan allows ${plan.limits.savedSearches} saved search${plan.limits.savedSearches === 1 ? '' : 'es'}.`, { code: 'SEARCH_LIMIT' });
    }
    const input = searchInput(await readJson(req), plan.limits.maxAlertRadiusKm, false);
    const row = { id: crypto.randomUUID(), user_id: auth.user.id, ...input };
    const { data, error } = await supabaseAdmin.from('saved_searches').insert(row).select('*').single();
    if (error) throw error;
    const found = await backfillMatches(data);
    after(() => recordServerEvent(req, 'saved_search_created', { userId: auth.user.id, variant: 'none', props: { plan: plan.plan } }));
    return NextResponse.json({ success: true, data: { search: mapSearchRow(data, found), existingMatches: found } }, { status: 201 });
  } catch (e) {
    return routeError(e, 'saved-searches POST');
  }
}
