// GET /api/profile – everything the profile page needs in one call:
// the user, their posted items, claims they made, claims they received, and counts.
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { countUnreadForUser, getItem, listClaimsByClaimant, listClaimsForItems, listItems } from '@/lib/db';
import { toPublicUser } from '@/lib/users';
import { routeError, toSummaries, withClaimInfo } from '@/lib/itemView';
import { ClaimWithItem, ProfileData } from '@/types';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  try {
    const posted = await listItems({ status: 'all', userId: user.id, includeHidden: true });
    const [postedItems, myClaims, receivedClaims, unreadMessages] = await Promise.all([
      withClaimInfo(posted, user.id),
      listClaimsByClaimant(user.id),
      listClaimsForItems(posted.map((i) => i.id)),
      // Messaging tables may not exist until migration 05 runs – never fail the profile for that.
      countUnreadForUser(user.id).catch(() => 0),
    ]);

    const claimedItems = (
      await Promise.all(Array.from(new Set(myClaims.map((c) => c.itemId))).map((id) => getItem(id)))
    ).filter((i): i is NonNullable<typeof i> => !!i);
    const summaries = await toSummaries([...posted, ...claimedItems]);
    const attach = (c: (typeof myClaims)[number]): ClaimWithItem => ({ ...c, item: summaries.get(c.itemId) });

    const data: ProfileData = {
      user: toPublicUser(user),
      stats: {
        posted: posted.length,
        postedFound: posted.filter((i) => i.type === 'found').length,
        postedLost: posted.filter((i) => i.type === 'lost').length,
        returned: posted.filter((i) => i.status === 'claimed' || i.status === 'resolved').length,
        claimsMade: myClaims.length,
        claimsApproved: myClaims.filter((c) => c.status === 'approved').length,
        claimsPending: myClaims.filter((c) => c.status === 'pending').length,
        claimsRejected: myClaims.filter((c) => c.status === 'rejected').length,
        claimsReceived: receivedClaims.length,
        claimsReceivedPending: receivedClaims.filter((c) => c.status === 'pending').length,
        unreadMessages,
      },
      postedItems,
      myClaims: myClaims.map(attach),
      receivedClaims: receivedClaims.map(attach),
    };
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return routeError(e, 'profile GET');
  }
}
