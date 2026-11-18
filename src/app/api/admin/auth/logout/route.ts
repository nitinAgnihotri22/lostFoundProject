// POST /api/admin/auth/logout – clears the admin cookie (the website session is untouched).
import { NextResponse } from 'next/server';
import { clearAdminCookie } from '@/lib/auth';

export async function POST() {
  return clearAdminCookie(NextResponse.json({ success: true }));
}
