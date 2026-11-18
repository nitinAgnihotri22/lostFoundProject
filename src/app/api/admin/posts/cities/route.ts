// GET /api/admin/posts/cities – cities that have posts, with counts (for the location filter).
import { NextRequest, NextResponse } from 'next/server';
import { adminRouteError, requireAdmin } from '@/lib/admin/server';
import { listCities } from '@/lib/admin/data';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'posts.view');
  if (auth.response) return auth.response;
  try {
    return NextResponse.json({ success: true, data: await listCities() });
  } catch (e) {
    return adminRouteError(e, 'posts/cities');
  }
}
