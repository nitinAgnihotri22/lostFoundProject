// GET  /api/boosts?itemId=… – boosts on the caller's item, reach estimates per package and their quota.
// POST /api/boosts { itemId, package } – boost an item (free during launch).
//   201 { boost, needsReview } – needsReview: the account's first boost waits for a quick admin check.
import { after, NextRequest, NextResponse } from 'next/server';
import { getItem } from '@/lib/db';
import { fail, requireAuth } from '@/lib/session';
import { readJson, routeError } from '@/lib/itemView';
import { boostsForItem, boostsUsed, boostTextProblem, createBoost, estimateReach, runBoostRound } from '@/lib/boosts';
import { getPlan } from '@/lib/billing';
import { BOOST_PACKAGE_IDS, PAYMENTS_ENABLED, type BoostPackage } from '@/lib/plans';
import { recordServerEvent } from '@/lib/analytics';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const itemId = req.nextUrl.searchParams.get('itemId') ?? '';
    const item = await getItem(itemId);
    if (!item || item.userId !== auth.user.id) return fail(404, 'Item not found');
    const [boosts, reach, used, plan] = await Promise.all([boostsForItem(item.id), estimateReach(item), boostsUsed(auth.user.id), getPlan(auth.user.id)]);
    return NextResponse.json({
      success: true,
      data: {
        boosts,
        reach,
        quota: { used, limit: plan.limits.boostsPer30Days },
        textProblem: boostTextProblem(item),
        paymentsEnabled: PAYMENTS_ENABLED,
      },
    });
  } catch (e) {
    return routeError(e, 'boosts GET');
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const body = await readJson(req);
    const pkg = String(body.package) as BoostPackage;
    if (!BOOST_PACKAGE_IDS.includes(pkg)) return fail(400, 'Choose a boost package.', { code: 'BAD_PACKAGE' });
    const { boost, needsReview } = await createBoost(auth.user.id, String(body.itemId ?? ''), pkg);
    // Send round 1 after responding.
    if (!needsReview) after(() => runBoostRound(boost.id).catch((e) => console.error('[boost] round 1 failed', e)));
    after(() => recordServerEvent(req, 'boost_started', { userId: auth.user.id, variant: 'none', props: { package: pkg, review: needsReview } }));
    return NextResponse.json({ success: true, data: { boost, needsReview } }, { status: 201 });
  } catch (e) {
    return routeError(e, 'boosts POST');
  }
}
