// GET    /api/items/{id} – item detail shaped for the viewer (public; token unlocks more).
// PATCH  /api/items/{id} – poster closes/reopens the item ({ status: 'resolved' | 'active' }).
// DELETE /api/items/{id} – poster deletes the item (claims and chats go with it).
import { NextRequest, NextResponse } from 'next/server';
import { deleteItem, getItem, isPublicItem, listClaimsForItem, updateItemStatus } from '@/lib/db';
import { fail, optionalAuth, requireAuth } from '@/lib/session';
import { forViewer, readJson, routeError } from '@/lib/itemView';
import { ItemDetail } from '@/types';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const viewer = await optionalAuth(request);
    const item = await getItem(id);
    if (!item) return fail(404, 'Item not found');
    // Under review, rejected or hidden by an admin: only the poster can see it.
    if (!isPublicItem(item) && viewer?.id !== item.userId) return fail(404, 'Item not found');

    const claims = await listClaimsForItem(item.id);
    const isOwner = !!viewer && viewer.id === item.userId;
    const myClaim = viewer && !isOwner ? claims.find((c) => c.claimantId === viewer.id) : undefined;

    const detail: ItemDetail = {
      ...forViewer(item, viewer?.id),
      claimCount: claims.length,
      myClaim,
      viewerRole: !viewer ? 'guest' : isOwner ? 'owner' : myClaim ? 'claimant' : 'visitor',
      // Full claim list (with proofs) is for the poster only.
      claims: isOwner ? claims : undefined,
      // Poster's contact is released to the approved claimant only.
      posterContact:
        myClaim?.status === 'approved'
          ? { name: item.userName, email: item.userEmail, phone: item.userPhone }
          : undefined,
    };
    return NextResponse.json({ success: true, data: detail });
  } catch (e) {
    return routeError(e, 'items/[id] GET');
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const item = await getItem(id);
    if (!item) return fail(404, 'Item not found');
    if (item.userId !== auth.user.id) return fail(403, 'Only the poster can update this item.', { code: 'NOT_ITEM_OWNER' });

    const body = await readJson(request);
    const status = body.status;
    if (status !== 'resolved' && status !== 'active') {
      return fail(400, 'status must be "resolved" (close the report) or "active" (reopen it).');
    }
    if (status === item.status) return fail(409, `Item is already ${status}.`, { code: 'NO_CHANGE' });
    if (status === 'active' && item.status === 'claimed') {
      return fail(409, 'This item has an approved claim and cannot be reopened.', { code: 'ITEM_CLAIMED' });
    }
    const updated = await updateItemStatus(id, status);
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    return routeError(e, 'items/[id] PATCH');
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const item = await getItem(id);
    if (!item) return fail(404, 'Item not found');
    if (item.userId !== auth.user.id) return fail(403, 'Only the poster can delete this item.', { code: 'NOT_ITEM_OWNER' });
    await deleteItem(id);
    return NextResponse.json({ success: true, message: 'Item deleted' });
  } catch (e) {
    return routeError(e, 'items/[id] DELETE');
  }
}
