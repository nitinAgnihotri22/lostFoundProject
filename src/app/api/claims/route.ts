import { NextRequest, NextResponse } from 'next/server';
import { getAllDbClaims, getAllDbItems, insertDbClaim } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { isOwnItem, OWN_ITEM_CLAIM_ERROR } from '@/lib/ownership';
import { ALREADY_CLAIMED_ERROR, findUserClaim } from '@/lib/claims';

// Returns only claims the caller made, or claims on items the caller reported.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  try {
    const [allClaims, items] = await Promise.all([getAllDbClaims(), getAllDbItems()]);
    const myItemIds = new Set(items.filter((i) => i.userId === user.id).map((i) => i.id));
    const claims = allClaims.filter((c) => c.claimantId === user.id || myItemIds.has(c.itemId));
    return NextResponse.json({
      success: true,
      count: claims.length,
      data: claims,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to retrieve claims' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON request' }, { status: 400 });
  }
  try {

    if (!body.itemId || !body.proof1 || !body.proof2 || !body.proof3) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required 3 verification proofs (proof1, proof2, proof3) or itemId.',
        },
        { status: 400 }
      );
    }

    const item = (await getAllDbItems()).find((i) => i.id === String(body.itemId));
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item not found.' }, { status: 404 });
    }
    if (isOwnItem(item, user)) {
      return NextResponse.json(
        { success: false, error: OWN_ITEM_CLAIM_ERROR, code: 'OWN_ITEM' },
        { status: 403 }
      );
    }
    const existing = findUserClaim(await getAllDbClaims(), item.id, user);
    if (existing) {
      return NextResponse.json(
        { success: false, error: ALREADY_CLAIMED_ERROR, code: 'ALREADY_CLAIMED', data: existing },
        { status: 409 }
      );
    }

    // Claimant details come from the authenticated user, not the request body.
    const newClaim = await insertDbClaim({
      itemId: item.id,
      itemTitle: item.title,
      claimantId: user.id,
      claimantName: user.name,
      claimantEmail: user.email,
      claimantPhone: body.phone || body.claimantPhone || user.phone || '',
      proof1: body.proof1,
      proof2: body.proof2,
      proof3: body.proof3,
    });

    return NextResponse.json({ success: true, data: newClaim }, { status: 201 });
  } catch (error) {
    console.error('[claims POST]', error);
    return NextResponse.json({ success: false, error: 'Failed to submit claim.' }, { status: 500 });
  }
}

