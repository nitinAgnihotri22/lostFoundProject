// GET  /api/conversations/{id}/messages?after=<ISO> – read the thread (marks it read); `after` for polling.
// POST /api/conversations/{id}/messages – send a message { body }.
// Only the two participants can read or post; everyone else gets 404.
import { NextRequest, NextResponse } from 'next/server';
import { fail, requireAuth } from '@/lib/session';
import { getConversationForUser, insertMessage, listMessages, markConversationRead } from '@/lib/db';
import { readJson, routeError } from '@/lib/itemView';
import { LIMITS, requireText } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const conversation = await getConversationForUser(id, auth.user.id);
    if (!conversation) return fail(404, 'Conversation not found.');

    const after = request.nextUrl.searchParams.get('after') ?? undefined;
    const messages = await listMessages(id, after);
    if (messages.some((m) => m.senderId !== auth.user.id && !m.readAt)) {
      await markConversationRead(id, auth.user.id);
    }
    return NextResponse.json({ success: true, data: { conversation: { ...conversation, unreadCount: 0 }, messages } });
  } catch (e) {
    return routeError(e, 'messages GET');
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const conversation = await getConversationForUser(id, auth.user.id);
    if (!conversation) return fail(404, 'Conversation not found.');

    const body = await readJson(request);
    const text = requireText(body.body ?? body.message, 'Message', 1, LIMITS.messageMax);
    const message = await insertMessage(id, auth.user.id, text);
    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (e) {
    return routeError(e, 'messages POST');
  }
}
