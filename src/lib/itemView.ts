// Server-side shaping of items for a given viewer.
import { Claim, Item, ItemSummary } from '@/types';
import { getUsersByIds, isMissingSchema, listClaimsForItems } from '@/lib/db';
import { NextResponse } from 'next/server';
import { ValidationError } from '@/lib/validation';

/** Strip the poster's contact details unless the viewer is the poster. */
export function forViewer(item: Item, viewerId?: string | null): Item {
  if (viewerId && item.userId === viewerId) return item;
  const { userEmail: _e, userPhone: _p, ...rest } = item;
  return rest;
}

/** Attach claimCount (+ the viewer's own claim) to a list of items, in one query. */
export async function withClaimInfo(items: Item[], viewerId?: string | null): Promise<Item[]> {
  const claims = await listClaimsForItems(items.map((i) => i.id));
  const counts = new Map<string, number>();
  const mine = new Map<string, Claim>();
  for (const c of claims) {
    counts.set(c.itemId, (counts.get(c.itemId) ?? 0) + 1);
    if (viewerId && c.claimantId === viewerId && !mine.has(c.itemId)) mine.set(c.itemId, c);
  }
  return items.map((i) => ({
    ...forViewer(i, viewerId),
    claimCount: counts.get(i.id) ?? 0,
    myClaim: mine.get(i.id),
  }));
}

export async function toSummaries(items: Item[]): Promise<Map<string, ItemSummary>> {
  const posters = await getUsersByIds(items.map((i) => i.userId));
  return new Map(
    items.map((i) => [
      i.id,
      {
        id: i.id,
        title: i.title,
        type: i.type,
        status: i.status,
        image: i.images[0],
        posterId: i.userId,
        posterName: posters.get(i.userId)?.name ?? i.userName,
      },
    ])
  );
}

/** Map thrown errors to API responses: validation → 400, missing migration → 503, anything else → 500. */
export function routeError(e: unknown, label: string): NextResponse {
  if (e instanceof ValidationError) {
    return NextResponse.json({ success: false, error: e.message, field: e.field }, { status: 400 });
  }
  if (isMissingSchema(e)) {
    console.error(`[${label}] database schema is behind:`, (e as any).message);
    return NextResponse.json(
      {
        success: false,
        code: 'MIGRATION_REQUIRED',
        error: 'This feature is not set up on the database yet. Run supabase/migrations/05_end_to_end.sql in the Supabase SQL editor.',
      },
      { status: 503 }
    );
  }
  console.error(`[${label}]`, e);
  return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    throw new ValidationError('Request body must be valid JSON.');
  }
}
