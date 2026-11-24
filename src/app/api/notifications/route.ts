// GET   /api/notifications – the caller's latest notifications + unread count.
//       ?countOnly=1 for the badge poll.
// PATCH /api/notifications { ids?: string[] } – mark read (all when no ids).
import { after, NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { readJson, routeError } from '@/lib/itemView';
import { maybeRunJobs } from '@/lib/jobs';
import type { AppNotification } from '@/types';

const mapRow = (r: any): AppNotification => ({
  id: String(r.id),
  kind: r.kind,
  title: String(r.title),
  body: String(r.body),
  url: r.url ?? undefined,
  itemId: r.item_id ?? undefined,
  read: !!r.read_at,
  createdAt: String(r.created_at),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  // Jobs fallback: the badge poll keeps queued alerts moving even without a cron.
  after(() => maybeRunJobs());
  try {
    const { count, error: cErr } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .is('read_at', null);
    if (cErr) throw cErr;
    if (req.nextUrl.searchParams.get('countOnly')) return NextResponse.json({ success: true, data: { unread: count ?? 0 } });
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ success: true, data: { unread: count ?? 0, notifications: (data ?? []).map(mapRow) } });
  } catch (e) {
    return routeError(e, 'notifications GET');
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const body = await readJson(req);
    let q = supabaseAdmin.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', auth.user.id).is('read_at', null);
    if (Array.isArray(body.ids) && body.ids.length) q = q.in('id', body.ids.slice(0, 100).map(String));
    const { error } = await q;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return routeError(e, 'notifications PATCH');
  }
}
