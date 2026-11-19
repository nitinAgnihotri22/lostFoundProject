// GET  /api/claims – the caller's claims (`mine`) and claims on the caller's items (`received`).
// POST /api/claims – submit a 3-proof claim on a found item.
import { NextRequest, NextResponse } from 'next/server';
import { isPublicItem, getItem, insertClaim, listClaimsByClaimant, listClaimsForItems, listItems } from '@/lib/db';
import { fail, requireAuth } from '@/lib/session';
import { readJson, routeError, toSummaries } from '@/lib/itemView';
import { LIMITS, requireText, str } from '@/lib/validation';
import { ALREADY_CLAIMED_ERROR, findUserClaim } from '@/lib/claims';
import { OWN_ITEM_CLAIM_ERROR } from '@/lib/ownership';
import { ClaimWithItem } from '@/types';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  try {
    const scope = request.nextUrl.searchParams.get('scope') ?? 'all';
    const myItems = scope === 'mine' ? [] : await listItems({ status: 'all', userId: user.id, includeHidden: true });
    const [mine, received] = await Promise.all([
      scope === 'received' ? [] : listClaimsByClaimant(user.id),
      scope === 'mine' ? [] : listClaimsForItems(myItems.map((i) => i.id)),
    ]);

    // Attach a small item summary to each claim so the UI can render it without extra calls.
    const mineItems = await Promise.all(Array.from(new Set(mine.map((c) => c.itemId))).map((id) => getItem(id)));
    const summaries = await toSummaries([...myItems, ...mineItems.filter((i): i is NonNullable<typeof i> => !!i)]);
    const attach = (c: (typeof mine)[number]): ClaimWithItem => ({ ...c, item: summaries.get(c.itemId) });

    return NextResponse.json({
      success: true,
      data: { mine: mine.map(attach), received: received.map(attach) },
      count: { mine: mine.length, received: received.length },
    });
  } catch (e) {
    return routeError(e, 'claims GET');
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
    const proof1 = requireText(body.proof1, 'Proof 1', 1, LIMITS.proofMax);
    const proof2 = requireText(body.proof2, 'Proof 2', 1, LIMITS.proofMax);
    const proof3 = requireText(body.proof3, 'Proof 3', 1, LIMITS.proofMax);
    const phone = str(body.phone || body.claimantPhone).slice(0, 40) || user.phone || '';

    const item = await getItem(itemId);
    if (!item || !isPublicItem(item)) return fail(404, 'Item not found.');
    if (item.type !== 'found') {
      return fail(400, 'Only found items can be claimed. If you found a lost item, message its owner instead.', { code: 'NOT_CLAIMABLE' });
    }
    if (item.status !== 'active') {
      return fail(409, item.status === 'claimed' ? 'This item has already been claimed and approved.' : 'This report has been closed by the poster.', { code: 'ITEM_CLOSED' });
    }
    if (item.userId === user.id) return fail(403, OWN_ITEM_CLAIM_ERROR, { code: 'OWN_ITEM' });

    const existing = findUserClaim(await listClaimsByClaimant(user.id), item.id, user);
    if (existing) return fail(409, ALREADY_CLAIMED_ERROR, { code: 'ALREADY_CLAIMED', data: existing });

    const claim = await insertClaim({
      itemId: item.id,
      itemTitle: item.title,
      // Claimant details come from the authenticated user, not the request body.
      claimantId: user.id,
      claimantName: user.name,
      claimantEmail: user.email,
      claimantPhone: phone,
      proof1, proof2, proof3,
    });
    return NextResponse.json({ success: true, data: claim }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') return fail(409, ALREADY_CLAIMED_ERROR, { code: 'ALREADY_CLAIMED' });
    return routeError(e, 'claims POST');
  }
}
