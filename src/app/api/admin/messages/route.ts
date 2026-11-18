// GET /api/admin/messages – Contact Us inbox. ?search= &status=new|in_progress|resolved|spam &subject= &page=
import { NextRequest, NextResponse } from 'next/server';
import { adminRouteError, requireAdmin } from '@/lib/admin/server';
import { listMessages, MESSAGE_STATUSES, MessageStatus } from '@/lib/admin/data';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'messages.view');
  if (auth.response) return auth.response;
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get('status') as MessageStatus | null;
    const data = await listMessages({
      search: sp.get('search') || undefined,
      status: status && MESSAGE_STATUSES.includes(status) ? status : undefined,
      subject: sp.get('subject') || undefined,
      page: Number(sp.get('page')) || 1,
      pageSize: Number(sp.get('pageSize')) || 25,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return adminRouteError(e, 'messages GET');
  }
}
