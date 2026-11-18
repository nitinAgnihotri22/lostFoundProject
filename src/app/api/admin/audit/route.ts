// GET /api/admin/audit – admin activity log (super admin). ?adminId= &action=prefix &page=
import { NextRequest, NextResponse } from 'next/server';
import { adminRouteError, requireAdmin } from '@/lib/admin/server';
import { listAudit } from '@/lib/admin/data';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'audit.view');
  if (auth.response) return auth.response;
  try {
    const sp = req.nextUrl.searchParams;
    const data = await listAudit({
      adminId: sp.get('adminId') || undefined,
      action: sp.get('action') || undefined,
      page: Number(sp.get('page')) || 1,
      pageSize: Number(sp.get('pageSize')) || 50,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return adminRouteError(e, 'audit GET');
  }
}
