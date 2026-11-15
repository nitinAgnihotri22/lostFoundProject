import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_ITEMS } from '@/lib/mockData';
import { requireAuth } from '@/lib/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const { id } = await params;
  const item = INITIAL_ITEMS.find((i) => i.id === id);

  if (!item) {
    return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: item });
}

