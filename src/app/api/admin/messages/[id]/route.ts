// PATCH /api/admin/messages/{id} – { status?, note? }
import { NextRequest, NextResponse } from 'next/server';
import { adminFail, adminRouteError, audit, requireAdmin } from '@/lib/admin/server';
import { MESSAGE_STATUSES, MessageStatus, updateMessage } from '@/lib/admin/data';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(req, 'messages.manage');
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const patch: { status?: MessageStatus; admin_note?: string | null } = {};
    if (body.status !== undefined) {
      if (!MESSAGE_STATUSES.includes(body.status)) return adminFail(400, 'Unknown status.');
      patch.status = body.status;
    }
    if (body.note !== undefined) patch.admin_note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) || null : null;
    if (Object.keys(patch).length === 0) return adminFail(400, 'Nothing to update.');
    const row = await updateMessage(id, patch, auth.admin);
    if (!row) return adminFail(404, 'Message not found.');
    await audit(auth.admin, 'message.update', { type: 'contact_message', id }, { reference: row.reference, ...('status' in patch ? { status: patch.status } : {}), ...('admin_note' in patch ? { note: true } : {}) }, req);
    return NextResponse.json({ success: true, data: row });
  } catch (e) {
    return adminRouteError(e, 'messages/[id] PATCH');
  }
}
