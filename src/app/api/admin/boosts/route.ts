// GET   /api/admin/boosts?status=pending_review|active|completed|cancelled|rejected&page=
// PATCH /api/admin/boosts { id, action: 'approve' | 'reject' | 'cancel', reason? }
//   approve/reject = a person's first boost (checker or super admin); cancel = stop a running boost.
import { after, NextRequest, NextResponse } from 'next/server';
import { adminFail, adminRouteError, audit, requireAdmin } from '@/lib/admin/server';
import { can } from '@/lib/admin/permissions';
import { supabaseAdmin } from '@/lib/db';
import { activateBoost, cancelBoost, mapBoostRow, rejectBoost, runBoostRound } from '@/lib/boosts';

const STATUSES = ['pending_review', 'active', 'completed', 'cancelled', 'rejected'];
const PAGE = 25;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'boosts.view');
  if (auth.response) return auth.response;
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get('status');
    const page = Math.max(1, Number(sp.get('page')) || 1);
    let q = supabaseAdmin
      .from('boosts')
      // Name the foreign keys: boosts reach items and users through other tables too
      // (boost_recipients, notifications), so a plain `users(...)` is ambiguous (PGRST201).
      .select('*, items!boosts_item_id_fkey(id, title, description, category, type, images, address, city, status, is_hidden, review_status), users!boosts_user_id_fkey(id, name, email, phone, created_at)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (status && STATUSES.includes(status)) q = q.eq('status', status);
    const [{ data, count, error }, pending] = await Promise.all([
      q,
      supabaseAdmin.from('boosts').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    ]);
    if (error) throw error;
    const rows = (data ?? []).map((r: any) => ({
      ...mapBoostRow(r),
      item: r.items ? { id: r.items.id, title: r.items.title, description: r.items.description, category: r.items.category, type: r.items.type, image: (Array.isArray(r.items.images) ? r.items.images : JSON.parse(r.items.images || '[]'))[0] ?? null, place: r.items.city || r.items.address, live: r.items.status === 'active' && !r.items.is_hidden && (r.items.review_status ?? 'approved') === 'approved' } : null,
      user: r.users ? { id: r.users.id, name: r.users.name, contact: r.users.email || r.users.phone || '', joinedAt: r.users.created_at } : null,
    }));
    return NextResponse.json({ success: true, data: { rows, total: count ?? 0, page, pageSize: PAGE, pendingCount: pending.count ?? 0 } });
  } catch (e) {
    return adminRouteError(e, 'boosts GET');
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, 'boosts.view');
  if (auth.response) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? '');
    const action = body.action;
    const reason = String(body.reason ?? '').trim().slice(0, 500);
    if (action === 'approve' || action === 'reject') {
      if (!can(auth.admin.role, 'boosts.review')) return adminFail(403, 'Only a checker or super admin can review boosts.');
      if (action === 'reject' && !reason) return adminFail(400, 'Give a reason (the poster sees it).', { field: 'reason' });
      const { data: b } = await supabaseAdmin.from('boosts').select('status').eq('id', id).maybeSingle();
      if (!b) return adminFail(404, 'Boost not found.');
      if (b.status !== 'pending_review') return adminFail(409, 'This boost is no longer waiting for review.');
      if (action === 'approve') {
        await activateBoost(id, auth.admin);
        after(() => runBoostRound(id).catch((e) => console.error('[boost] round 1 failed', e)));
      } else {
        await rejectBoost(id, reason, auth.admin);
      }
    } else if (action === 'cancel') {
      if (!can(auth.admin.role, 'boosts.manage')) return adminFail(403, 'You cannot stop boosts.');
      await cancelBoost(id, {});
    } else {
      return adminFail(400, 'Unknown action.');
    }
    await audit(auth.admin, `boost.${action}`, { type: 'boost', id }, reason ? { reason } : null, req);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.code === 'NOT_PENDING' || e?.code === 'NOT_FOUND') return adminFail(e.status, e.message);
    return adminRouteError(e, 'boosts PATCH');
  }
}
