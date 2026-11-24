// POST /api/admin/jobs – run background jobs now (alert rounds, queued push/email, digest).
import { NextRequest, NextResponse } from 'next/server';
import { adminRouteError, audit, requireAdmin } from '@/lib/admin/server';
import { runJobs } from '@/lib/jobs';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'boosts.manage');
  if (auth.response) return auth.response;
  try {
    const result = await runJobs();
    await audit(auth.admin, 'jobs.run', { type: 'jobs' }, null, req);
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return adminRouteError(e, 'jobs');
  }
}
