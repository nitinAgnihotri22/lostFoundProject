// GET|POST /api/cron/run – run background jobs (alert rounds, queued push/email, daily digest).
// Needs `Authorization: Bearer $CRON_SECRET`. Call every 5–15 minutes from a scheduler.
import { NextRequest, NextResponse } from 'next/server';
import { runJobs } from '@/lib/jobs';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ success: true, data: await runJobs() });
}

export const POST = GET;
