import { NextRequest, NextResponse } from 'next/server';
import { getAllDbItems, insertDbItem } from '@/lib/db';
import { INITIAL_ITEMS } from '@/lib/mockData';
import { calculateDistanceKm } from '@/lib/geo';
import { Item, Category } from '@/types';
import { requireAuth } from '@/lib/session';

async function getItemsList(): Promise<Item[]> {
  try {
    const items = await getAllDbItems();
    return items.length > 0 ? items : INITIAL_ITEMS;
  } catch {
    return INITIAL_ITEMS;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const category = searchParams.get('category');
  const query = searchParams.get('query')?.toLowerCase();
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');
  const radiusKm = parseFloat(searchParams.get('radiusKm') || '5');
  const startDate = searchParams.get('startDate');

  const centerLat = latStr ? parseFloat(latStr) : null;
  const centerLng = lngStr ? parseFloat(lngStr) : null;

  const currentItems = await getItemsList();

  let results = currentItems.map((item) => {
    let distanceKm: number | undefined = undefined;
    if (centerLat !== null && centerLng !== null) {
      distanceKm = calculateDistanceKm(centerLat, centerLng, item.location.lat, item.location.lng);
    }
    return { ...item, distanceKm };
  });

  if (type && type !== 'all') {
    results = results.filter((i) => i.type === type);
  }

  if (category && category !== 'all') {
    results = results.filter((i) => i.category === category);
  }

  if (query) {
    results = results.filter(
      (i) =>
        i.title.toLowerCase().includes(query) ||
        i.description.toLowerCase().includes(query) ||
        i.location.address.toLowerCase().includes(query)
    );
  }

  if (centerLat !== null && centerLng !== null) {
    results = results.filter((i) => i.distanceKm !== undefined && i.distanceKm <= radiusKm);
    results.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  } else {
    results.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  if (startDate) {
    const startTime = new Date(startDate).getTime();
    results = results.filter((i) => new Date(i.occurredAt).getTime() >= startTime);
  }

  return NextResponse.json({
    success: true,
    count: results.length,
    data: results,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;
  const { user } = auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON request body.' }, { status: 400 });
  }
  try {

    if (!body.title || !body.description || !body.type || !body.category || !body.location) {
      return NextResponse.json(
        { success: false, error: 'Missing required item fields (title, description, type, category, location).' },
        { status: 400 }
      );
    }

    if (body.type === 'found' && (!body.images || body.images.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'At least one image is mandatory when reporting a found item.' },
        { status: 400 }
      );
    }

    // Owner details come from the authenticated user, not the request body.
    const newItem = await insertDbItem({
      type: body.type,
      title: body.title,
      description: body.description,
      category: body.category as Category,
      images: body.images || [],
      location: body.location,
      occurredAt: body.occurredAt || new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userPhone: body.userPhone ?? user.phone ?? undefined,
      reward: body.reward || 0,
      verificationQuestions: body.verificationQuestions,
    });

    return NextResponse.json({ success: true, data: newItem }, { status: 201 });
  } catch (error) {
    console.error('[items POST]', error);
    return NextResponse.json({ success: false, error: 'Failed to create item.' }, { status: 500 });
  }
}

