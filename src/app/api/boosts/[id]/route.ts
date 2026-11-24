// DELETE /api/boosts/{id} – the owner stops their boost (alerts already sent stay sent).
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { routeError } from '@/lib/itemView';
import { cancelBoost } from '@/lib/boosts';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    await cancelBoost(id, { userId: auth.user.id });
    return NextResponse.json({ success: true });
  } catch (e) {
    return routeError(e, 'boosts DELETE');
  }
}
