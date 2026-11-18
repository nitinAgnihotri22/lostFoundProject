// GET  /api/conversations – the caller's conversations, newest activity first.
// POST /api/conversations – start (or reopen) a conversation about an item.
//   { itemId, recipientId?, message? }
//   - a visitor/claimant messages the poster (recipient defaults to the poster)
//   - the poster messages one of the item's claimants (recipientId required)
import { NextRequest, NextResponse } from 'next/server';
import { fail, requireAuth } from '@/lib/session';
import { findOrCreateConversation, getItem, getUsersByIds, insertMessage, listClaimsForItem, listConversationsForUser } from '@/lib/db';
import { readJson, routeError } from '@/lib/itemView';
import { LIMITS, str } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  try {
    const conversations = await listConversationsForUser(auth.user.id);
    const unreadTotal = conversations.reduce((n, c) => n + c.unreadCount, 0);
    return NextResponse.json({ success: true, count: conversations.length, unreadTotal, data: conversations });
  } catch (e) {
    return routeError(e, 'conversations GET');
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  try {
    const body = await readJson(request);
    const itemId = str(body.itemId);
    if (!itemId) return fail(400, 'itemId is required.');
    const item = await getItem(itemId);
    if (!item || item.hiddenByAdmin) return fail(404, 'Item not found.');

    const isPoster = item.userId === user.id;
    let recipientId = str(body.recipientId);

    if (isPoster) {
      if (!recipientId) return fail(400, 'recipientId is required when you are the poster.');
      const claims = await listClaimsForItem(item.id);
      if (!claims.some((c) => c.claimantId === recipientId)) {
        return fail(403, 'You can only message people who have claimed this item.', { code: 'NOT_A_CLAIMANT' });
      }
    } else {
      if (recipientId && recipientId !== item.userId) {
        return fail(403, 'You can only message the person who posted this item.', { code: 'NOT_POSTER' });
      }
      recipientId = item.userId;
    }
    if (recipientId === user.id) return fail(400, 'You cannot message yourself.', { code: 'SELF_MESSAGE' });
    if (!(await getUsersByIds([recipientId])).has(recipientId)) return fail(404, 'Recipient not found.');

    const { conversation, created } = await findOrCreateConversation(item.id, user.id, recipientId);

    const firstMessage = str(body.message);
    if (firstMessage) {
      if (firstMessage.length > LIMITS.messageMax) return fail(400, `Messages must be ${LIMITS.messageMax} characters or fewer.`);
      await insertMessage(conversation.id, user.id, firstMessage);
    }
    return NextResponse.json({ success: true, created, data: conversation }, { status: created ? 201 : 200 });
  } catch (e) {
    return routeError(e, 'conversations POST');
  }
}
