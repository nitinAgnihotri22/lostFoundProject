// GET   /api/admin/posts – every post (including hidden), filterable by location.
//   ?search= &city= (exact; "__none__" = no city) &type=found|lost &status=active|claimed|resolved
//   &visibility=visible|hidden &userId= &lat=&lng=&radiusKm= (nearest first) &page=&pageSize=
// PATCH /api/admin/posts – { ids: string[], action: 'hide' | 'show', reason? }
//   Hidden posts disappear from the website (list, detail, claims, new chats);
//   the poster still sees them in their profile, marked "Removed by moderator".
import { NextRequest, NextResponse } from 'next/server';
import { adminFail, adminRouteError, audit, requireAdmin } from '@/lib/admin/server';
import { listPosts, setPostsHidden, PostFilters } from '@/lib/admin/data';

const pick = <T extends string>(v: string | null, allowed: readonly T[]) => (v && allowed.includes(v as T) ? (v as T) : undefined);

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'posts.view');
  if (auth.response) return auth.response;
  try {
    const sp = req.nextUrl.searchParams;
    const lat = parseFloat(sp.get('lat') ?? '');
    const lng = parseFloat(sp.get('lng') ?? '');
    const radiusKm = Math.min(500, Math.max(0.5, parseFloat(sp.get('radiusKm') ?? '10') || 10));
    const filters: PostFilters = {
      search: sp.get('search') || undefined,
      city: sp.get('city') || undefined,
      type: pick(sp.get('type'), ['found', 'lost'] as const),
      status: pick(sp.get('status'), ['active', 'claimed', 'resolved'] as const),
      visibility: pick(sp.get('visibility'), ['visible', 'hidden'] as const),
      userId: sp.get('userId') || undefined,
      near: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, radiusKm } : undefined,
      page: Number(sp.get('page')) || 1,
      pageSize: Number(sp.get('pageSize')) || 25,
    };
    return NextResponse.json({ success: true, data: await listPosts(filters) });
  } catch (e) {
    return adminRouteError(e, 'posts GET');
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, 'posts.moderate');
  if (auth.response) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 200) : [];
    if (ids.length === 0) return adminFail(400, 'Select at least one post.');
    if (body.action !== 'hide' && body.action !== 'show') return adminFail(400, 'action must be "hide" or "show".');
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) || null : null;
    if (body.action === 'hide' && !reason) return adminFail(400, 'Give a reason for hiding (the poster sees it).', { field: 'reason' });

    const changed = await setPostsHidden(ids, body.action === 'hide', reason, auth.admin);
    await audit(auth.admin, body.action === 'hide' ? 'post.hide' : 'post.show', { type: 'item', id: ids.length === 1 ? ids[0] : undefined }, { ids, reason, changed }, req);
    return NextResponse.json({ success: true, data: { changed } });
  } catch (e) {
    return adminRouteError(e, 'posts PATCH');
  }
}
