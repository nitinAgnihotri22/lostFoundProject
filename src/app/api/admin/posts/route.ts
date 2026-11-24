// GET   /api/admin/posts – every post (including hidden), filterable by location.
//   ?search= &city= (exact; "__none__" = no city) &type=found|lost &status=active|claimed|resolved
//   &visibility=visible|hidden &userId= &lat=&lng=&radiusKm= (nearest first) &page=&pageSize=
//   &review=pending|approved|rejected &order=oldest
// PATCH /api/admin/posts – { ids: string[], action: 'hide' | 'show' | 'approve' | 'reject', reason? }
//   approve / reject = maker-checker review (checker or super admin only).
//   Rejecting needs a reason; the poster sees it.
//   Hidden posts disappear from the website (list, detail, claims, new chats);
//   the poster still sees them in their profile, marked "Removed by moderator".
import { after, NextRequest, NextResponse } from 'next/server';
import { notifyPostsReviewed } from '@/lib/notifications';
import { recordEvents } from '@/lib/analytics';
import { matchNewItem } from '@/lib/matching';
import { adminFail, adminRouteError, audit, requireAdmin } from '@/lib/admin/server';
import { listPosts, reviewPosts, setPostsHidden, PostFilters } from '@/lib/admin/data';

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
      review: pick(sp.get('review'), ['pending', 'approved', 'rejected'] as const),
      oldestFirst: sp.get('order') === 'oldest',
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
  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = body?.action;
  const isReview = action === 'approve' || action === 'reject';
  if (!isReview && action !== 'hide' && action !== 'show') return adminFail(400, 'action must be hide, show, approve or reject.');

  // Maker-checker: reviewing needs posts.review (checker / super admin); hide/show needs posts.moderate.
  const auth = await requireAdmin(req, isReview ? 'posts.review' : 'posts.moderate');
  if (auth.response) return auth.response;
  try {
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 200) : [];
    if (ids.length === 0) return adminFail(400, 'Select at least one post.');
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) || null : null;

    if (isReview) {
      if (action === 'reject' && !reason) return adminFail(400, 'Give a reason for rejecting (the poster sees it).', { field: 'reason' });
      const changed = await reviewPosts(ids, action, reason, auth.admin);
      await audit(auth.admin, action === 'approve' ? 'post.approve' : 'post.reject', { type: 'item', id: ids.length === 1 ? ids[0] : undefined }, { ids, reason, changed: changed.length }, req);
      // Email the posters after responding, so the reviewer isn't kept waiting.
      if (changed.length) {
        const admin = auth.admin;
        after(async () => {
          // Approved found items go live now → check them against people's saved searches.
          if (action === 'approve') for (const id of changed) await matchNewItem(id);
          await recordEvents(changed.map(() => ({ name: action === 'approve' ? 'post_approved' as const : 'post_rejected' as const, variant: 'none' as const })));
          const result = await notifyPostsReviewed(changed, action, reason);
          await audit(admin, 'email.review_notice', { type: 'item' }, { decision: action, ...result });
        });
      }
      return NextResponse.json({ success: true, data: { changed: changed.length, skipped: ids.length - changed.length } });
    }

    if (action === 'hide' && !reason) return adminFail(400, 'Give a reason for hiding (the poster sees it).', { field: 'reason' });
    const changed = await setPostsHidden(ids, action === 'hide', reason, auth.admin);
    await audit(auth.admin, action === 'hide' ? 'post.hide' : 'post.show', { type: 'item', id: ids.length === 1 ? ids[0] : undefined }, { ids, reason, changed }, req);
    return NextResponse.json({ success: true, data: { changed } });
  } catch (e) {
    return adminRouteError(e, 'posts PATCH');
  }
}
