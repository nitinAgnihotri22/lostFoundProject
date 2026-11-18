// GET  /api/items – browse active items (public; a token adds `myClaim` per item).
//      ?mine=1 (token required) returns the caller's own items in every status.
// POST /api/items – report a found/lost item (token required).
import { NextRequest, NextResponse } from 'next/server';
import { insertItem, listItems } from '@/lib/db';
import { calculateDistanceKm } from '@/lib/geo';
import { optionalAuth, requireAuth } from '@/lib/session';
import { forViewer, readJson, routeError, withClaimInfo } from '@/lib/itemView';
import {
  CATEGORIES, ITEM_TYPES, LIMITS, optionalQuestions, requireCoords, requireEnum,
  requireImageUrls, requirePastDate, requireText, ValidationError,
} from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const viewer = await optionalAuth(request);
    const { searchParams } = request.nextUrl;

    if (searchParams.get('mine') === '1') {
      if (!viewer) {
        return NextResponse.json({ success: false, error: 'Sign in to list your own items.' }, { status: 401 });
      }
      const mine = await withClaimInfo(await listItems({ status: 'all', userId: viewer.id, includeHidden: true }), viewer.id);
      return NextResponse.json({ success: true, count: mine.length, data: mine });
    }

    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const query = searchParams.get('query')?.toLowerCase();
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
    const radiusKm = parseFloat(searchParams.get('radiusKm') || '5');
    const startDate = searchParams.get('startDate');
    const excludeMine = searchParams.get('excludeMine') === '1';

    let results = (await listItems({ status: 'active' })).map((item) => ({
      ...item,
      distanceKm:
        lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)
          ? calculateDistanceKm(lat, lng, item.location.lat, item.location.lng)
          : undefined,
    }));

    if (excludeMine && viewer) results = results.filter((i) => i.userId !== viewer.id);
    if (type && type !== 'all') results = results.filter((i) => i.type === type);
    if (category && category !== 'all') results = results.filter((i) => i.category === category);
    if (query) {
      results = results.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          i.description.toLowerCase().includes(query) ||
          i.location.address.toLowerCase().includes(query)
      );
    }
    if (lat !== null && lng !== null) {
      results = results.filter((i) => i.distanceKm !== undefined && i.distanceKm <= radiusKm);
      results.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    } else {
      results.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    }
    if (startDate) {
      const start = new Date(startDate).getTime();
      if (!Number.isNaN(start)) results = results.filter((i) => new Date(i.occurredAt).getTime() >= start);
    }

    const data = await withClaimInfo(results, viewer?.id);
    // withClaimInfo drops distanceKm (it rebuilds the object) – put it back.
    const withDistance = data.map((item, idx) => ({ ...item, distanceKm: results[idx].distanceKm }));
    return NextResponse.json({ success: true, count: withDistance.length, data: withDistance });
  } catch (e) {
    return routeError(e, 'items GET');
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  try {
    const body = await readJson(request);
    const type = requireEnum(body.type, ITEM_TYPES, 'type');
    const images = requireImageUrls(body.images);
    if (type === 'found' && images.length === 0) {
      throw new ValidationError('At least one photo is required when reporting a found item.', 'images');
    }

    const item = await insertItem({
      type,
      title: requireText(body.title, 'Title', LIMITS.titleMin, LIMITS.titleMax),
      description: requireText(body.description, 'Description', LIMITS.descriptionMin, LIMITS.descriptionMax),
      category: requireEnum(body.category, CATEGORIES, 'category'),
      images,
      location: requireCoords(body.location),
      occurredAt: requirePastDate(body.occurredAt, 'occurredAt'),
      // The poster is always the authenticated user – never taken from the body.
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userPhone: (typeof body.userPhone === 'string' && body.userPhone.trim()) || user.phone || undefined,
      reward: Math.max(0, Math.min(Number(body.reward) || 0, 1_000_000)),
      verificationQuestions: optionalQuestions(body.verificationQuestions, type === 'found'),
    });

    return NextResponse.json({ success: true, data: { ...forViewer(item, user.id), claimCount: 0 } }, { status: 201 });
  } catch (e) {
    return routeError(e, 'items POST');
  }
}
