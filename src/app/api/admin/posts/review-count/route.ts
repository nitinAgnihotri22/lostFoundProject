// GET /api/admin/posts/review-count – number of posts waiting for review (menu badge).
import { NextRequest, NextResponse } from 'next/server';
import { adminRouteError, requireAdmin } from '@/lib/admin/server';
import { countPendingReview } from '@/lib/admin/data';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'posts.review');
  if (auth.response) return auth.response;
  try {
    return NextResponse.json({ success: true, data: { pending: await countPendingReview() } });
  } catch (e) {
    return adminRouteError(e, 'posts/review-count');
  }
}
