// GET /api/admin/stats – dashboard numbers.
import { NextRequest, NextResponse } from 'next/server';
import { adminRouteError, requireAdmin } from '@/lib/admin/server';
import { dashboardStats } from '@/lib/admin/data';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'dashboard.view');
  if (auth.response) return auth.response;
  try {
    return NextResponse.json({ success: true, data: await dashboardStats() });
  } catch (e) {
    return adminRouteError(e, 'stats');
  }
}
