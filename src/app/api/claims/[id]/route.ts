// PATCH /api/claims/{id} – the item's poster approves or rejects a claim.
// Approving marks the item "claimed" and auto-rejects every other pending claim on it.
// A reason is mandatory when rejecting; it is shown to the claimant.
import { after, NextRequest, NextResponse } from 'next/server';
import { recordServerEvent } from '@/lib/analytics';
import { fail, requireAuth } from '@/lib/session';
import { getClaim, getItem, rejectOtherPendingClaims, updateClaimStatus, updateItemStatus } from '@/lib/db';
import { readJson, routeError } from '@/lib/itemView';
import { LIMITS, str } from '@/lib/validation';

const AUTO_REJECT_REASON = 'Another claim on this item was approved by the poster.';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  try {
    const body = await readJson(request);
    const status = body.status;
    if (status !== 'approved' && status !== 'rejected') {
      return fail(400, 'Status must be either "approved" or "rejected".');
    }
    const reason = str(body.reason ?? body.notes);
    if (status === 'rejected' && !reason) return fail(400, 'A "reason" is required when rejecting a claim.');
    if (reason.length > LIMITS.reasonMax) return fail(400, `Reason must be ${LIMITS.reasonMax} characters or fewer.`);

    const { id } = await params;
    const claim = await getClaim(id);
    if (!claim) return fail(404, 'Claim not found.');

    const item = await getItem(claim.itemId);
    if (!item || item.userId !== user.id) {
      return fail(403, 'Only the person who posted this item can review its claims.', { code: 'NOT_ITEM_OWNER' });
    }
    if (claim.status !== 'pending') {
      return fail(409, `This claim has already been ${claim.status}.`, { code: 'ALREADY_REVIEWED' });
    }
    if (status === 'approved' && item.status !== 'active') {
      return fail(409, item.status === 'claimed' ? 'Another claim on this item was already approved.' : 'This report is closed – reopen it before approving a claim.', { code: 'ITEM_CLOSED' });
    }

    // Approve: close the item first so a failure leaves the claim untouched, then
    // record the approval and turn away the other pending claimants.
    let autoRejected = 0;
    if (status === 'approved') await updateItemStatus(item.id, 'claimed');
    const updated = await updateClaimStatus(id, status, reason || null);
    if (status === 'approved') {
      autoRejected = await rejectOtherPendingClaims(item.id, id, AUTO_REJECT_REASON);
      // The claimant's ads group, not the poster's, is what the A/B test compares – so no variant here.
      after(() => recordServerEvent(request, 'claim_approved', { userId: claim.claimantId, variant: 'none', props: { category: item.category } }));
    }

    return NextResponse.json({
      success: true,
      message: `Claim ${id} ${status}${autoRejected ? `; ${autoRejected} other pending claim(s) auto-rejected` : ''}`,
      data: updated,
      autoRejected,
    });
  } catch (e) {
    return routeError(e, 'claims PATCH');
  }
}
