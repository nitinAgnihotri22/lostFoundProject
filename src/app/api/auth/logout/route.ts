// POST /api/auth/logout – clears the auth cookie.
import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export async function POST() {
  return clearAuthCookie(NextResponse.json({ ok: true }));
}
