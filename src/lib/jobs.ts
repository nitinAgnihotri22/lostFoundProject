// Background jobs (server only): queued notifications, boost alert rounds,
// ending boosts and the free users' daily digest.
// -------------------------------------------------------------------
// Two ways they run:
//  1. /api/cron/run with `Authorization: Bearer $CRON_SECRET` – call it every
//     5–15 minutes from any scheduler (Vercel Cron, Supabase pg_cron, cron-job.org).
//  2. As a fallback, normal site traffic triggers them at most every 5 minutes
//     per server (maybeRunJobs), so they still run without a scheduler.
// -------------------------------------------------------------------
import { supabaseAdmin } from '@/lib/db';
import { deliverDue, istDayStart, istHour } from '@/lib/notify';
import { runDueBoosts } from '@/lib/boosts';
import { runDigest } from '@/lib/matching';

/** Digest goes out once a day, after this hour (IST). */
export const DIGEST_HOUR_IST = 9;

let running: Promise<unknown> | null = null;
let lastRun = 0;
let missingTables = false;

const isMissing = (e: any) => ['PGRST205', '42P01', 'PGRST204', '42703'].includes(e?.code);

async function digestIfDue(): Promise<{ users: number; matches: number } | null> {
  if (istHour() < DIGEST_HOUR_IST) return null;
  const today = istDayStart().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin.from('site_settings').select('value').eq('key', 'jobs').maybeSingle();
  if ((data?.value as any)?.digestDay === today) return null;
  // Mark first so two servers don't both send it.
  await supabaseAdmin.from('site_settings').upsert({ key: 'jobs', value: { ...((data?.value as object) ?? {}), digestDay: today }, updated_at: new Date().toISOString() });
  return runDigest();
}

export async function runJobs() {
  const out: Record<string, unknown> = { at: new Date().toISOString() };
  try {
    out.boosts = await runDueBoosts();
    out.delivered = await deliverDue({ limit: 300 });
    out.digest = await digestIfDue();
    missingTables = false;
  } catch (e: any) {
    if (isMissing(e)) {
      missingTables = true;
      out.error = 'Run supabase/migrations/11_boosts_premium.sql first.';
    } else {
      console.error('[jobs] failed', e?.message ?? e);
      out.error = String(e?.message ?? e);
    }
  }
  return out;
}

/** Run the jobs if they haven't run on this server for 5 minutes. Cheap to call often. */
export function maybeRunJobs(): Promise<unknown> | null {
  const gap = missingTables ? 30 * 60_000 : 5 * 60_000;
  if (running || Date.now() - lastRun < gap) return null;
  lastRun = Date.now();
  running = runJobs().finally(() => {
    running = null;
  });
  return running;
}
