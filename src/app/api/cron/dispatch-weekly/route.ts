import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { GET as run13FSync } from '@/app/api/data/13f/sync/route';
import { GET as runHarvestScan } from '@/app/api/tax/harvest-scan/route';

// Weekly dispatcher: runs Sundays at 02:00 UTC.
// Jobs run sequentially so harvest-scan can use fresh 13F holdings data.
const WEEKLY_JOBS = ['13f-sync', 'harvest-scan'] as const;

type WeeklyJob = (typeof WEEKLY_JOBS)[number];

const HANDLERS: Record<WeeklyJob, (req: NextRequest) => Promise<NextResponse>> = {
  '13f-sync':     run13FSync as (req: NextRequest) => Promise<NextResponse>,
  'harvest-scan': runHarvestScan,
};

function makeCronRequest(originalReq: NextRequest): NextRequest {
  const secret = process.env.CRON_SECRET ?? '';
  return new NextRequest(originalReq.url, {
    method:  'GET',
    headers: { authorization: `Bearer ${secret}` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markRan(admin: any, jobName: string, slotKey: string): Promise<boolean> {
  const { error } = await admin.from('cron_runs').insert({ job_name: jobName, slot_key: slotKey });
  if (error) {
    if (error.code === '23505') return false;
    console.error('[dispatch-weekly] cron_runs insert error:', error.message);
  }
  return true;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const hasBearerSecret = cronSecret ? auth === `Bearer ${cronSecret}` : false;

  if (!isVercelCron && !hasBearerSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const slotKey = `weekly:${dateStr}`;

  console.log(`[dispatch-weekly] starting weekly run for ${dateStr}`);

  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const results: Array<{ job: string; status: string; reason?: string }> = [];

  // Sequential: 13f-sync must finish before harvest-scan
  for (const job of WEEKLY_JOBS) {
    const fresh = await markRan(admin, job, slotKey);
    if (!fresh) {
      console.log(`[dispatch-weekly] skip ${job} — already ran for ${dateStr}`);
      results.push({ job, status: 'skipped', reason: 'already_ran' });
      continue;
    }

    try {
      console.log(`[dispatch-weekly] dispatching ${job}`);
      const jobReq = makeCronRequest(req);
      const res = await HANDLERS[job](jobReq);
      const status = res.status >= 200 && res.status < 300 ? 'ok' : `http_${res.status}`;
      console.log(`[dispatch-weekly] ${job} → ${status}`);
      results.push({ job, status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[dispatch-weekly] ${job} threw:`, msg);
      results.push({ job, status: 'error', reason: msg });
      // Continue to next job even on failure
    }
  }

  console.log(`[dispatch-weekly] done:`, results);
  return NextResponse.json({ date: dateStr, results });
}
