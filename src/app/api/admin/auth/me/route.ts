// GET /api/admin/auth/me – the signed-in admin (401 when the admin session is missing/ended).
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, toAdminProfile } from '@/lib/admin/server';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, null);
  if (auth.response) return auth.response;
  return NextResponse.json({ success: true, data: toAdminProfile(auth.admin) });
}
