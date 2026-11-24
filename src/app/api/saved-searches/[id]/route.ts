// PATCH  /api/saved-searches/{id} – edit or pause (active: false) a saved search.
// DELETE /api/saved-searches/{id} – delete it (and its matches).
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { fail, requireAuth } from '@/lib/session';
import { readJson, routeError } from '@/lib/itemView';
import { getPlan } from '@/lib/billing';
import { backfillMatches, mapSearchRow } from '@/lib/matching';
import { searchInput } from '../input';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const plan = await getPlan(auth.user.id);
    const patch = searchInput(await readJson(req), plan.limits.maxAlertRadiusKm, true);
    const { data, error } = await supabaseAdmin.from('saved_searches').update(patch).eq('id', id).eq('user_id', auth.user.id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return fail(404, 'Saved search not found.');
    if (data.active) await backfillMatches(data);
    return NextResponse.json({ success: true, data: { search: mapSearchRow(data) } });
  } catch (e) {
    return routeError(e, 'saved-searches PATCH');
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const { error } = await supabaseAdmin.from('saved_searches').delete().eq('id', id).eq('user_id', auth.user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return routeError(e, 'saved-searches DELETE');
  }
}
