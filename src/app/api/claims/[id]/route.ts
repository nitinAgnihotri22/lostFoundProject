// PATCH /api/claims/{id} – the item's poster approves or rejects a claim.
// A reason is mandatory when rejecting; it is shown to the claimant.
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { getAllDbItems, getDbClaimById, updateDbClaimStatus } from '@/lib/db';
import { isOwnItem } from '@/lib/ownership';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON request' }, { status: 400 });
  }

  if (!body.status || !['approved', 'rejected'].includes(body.status)) {
    return NextResponse.json(
      { success: false, error: 'Status must be either "approved" or "rejected".' },
      { status: 400 }
    );
  }

  const reason = String(body.reason ?? body.notes ?? '').trim();
  if (body.status === 'rejected' && !reason) {
    return NextResponse.json(
      { success: false, error: 'A "reason" is required when rejecting a claim.' },
      { status: 400 }
    );
  }
  if (reason.length > 300) {
    return NextResponse.json(
      { success: false, error: 'Reason must be 300 characters or fewer.' },
      { status: 400 }
    );
  }

  try {
    const { id } = await params;
    const claim = await getDbClaimById(id);
    if (!claim) {
      return NextResponse.json({ success: false, error: 'Claim not found.' }, { status: 404 });
    }

    const item = (await getAllDbItems()).find((i) => i.id === claim.itemId);
    if (!item || !isOwnItem(item, user)) {
      return NextResponse.json(
        { success: false, error: 'Only the person who posted this item can review its claims.', code: 'NOT_ITEM_OWNER' },
        { status: 403 }
      );
    }

    if (claim.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `This claim has already been ${claim.status}.`, code: 'ALREADY_REVIEWED' },
        { status: 409 }
      );
    }

    const updated = await updateDbClaimStatus(id, body.status, reason || null);
    return NextResponse.json({
      success: true,
      message: `Claim ${id} status updated to ${body.status}`,
      data: updated,
    });
  } catch (error) {
    console.error('[claims PATCH]', error);
    return NextResponse.json({ success: false, error: 'Failed to update claim.' }, { status: 500 });
  }
}
