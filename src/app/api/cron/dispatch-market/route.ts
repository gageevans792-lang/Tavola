import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { GET as runAutopilot } from '@/app/api/ai/autopilot/run/route';
import { GET as runAlertsMonitor } from '@/app/api/alerts/monitor/route';
import { GET as runDailyBriefing } from '@/app/api/ai/intelligence/daily-briefing/route';
import { GET as sendDailyBriefing } from '@/app/api/email/send-daily-briefing/route';
import { GET as runGeopoliticalPulse } from '@/app/api/ai/intelligence/geopolitical-pulse/route';
import { GET as runIntradayCheckpoint } from '@/app/api/ai/intraday/checkpoint/route';

// Jobs dispatched per 15-min UTC slot (H:bucket).
// Bucket = Math.floor(minute / 15) * 15.
// Original schedules mapped:
//   09:00 → autopilot + alerts-monitor
//   10:30 → daily-briefing
//   10:45 → send-daily-briefing
//   13:30 → geopolitical-pulse
//   14:30 → intraday-checkpoint (original was 14:35; bucket rounds to :30)
//   18:00 → intraday-checkpoint
//   20:30 → intraday-checkpoint
const SCHEDULE: Record<string, string[]> = {
  '9:0':   ['autopilot', 'alerts-monitor'],
  '10:30': ['daily-briefing'],
  '10:45': ['send-daily-briefing'],
  '13:30': ['geopolitical-pulse'],
  '14:30': ['intraday-checkpoint'],
  '18:0':  ['intraday-checkpoint'],
  '20:30': ['intraday-checkpoint'],
};

type JobHandler = (req: NextRequest) => Promise<NextResponse>;

const HANDLERS: Record<string, JobHandler> = {
  'autopilot':            runAutopilot,
  'alerts-monitor':       runAlertsMonitor,
  'daily-briefing':       runDailyBriefing,
  'send-daily-briefing':  sendDailyBriefing,
  'geopolitical-pulse':   runGeopoliticalPulse,
  'intraday-checkpoint':  runIntradayCheckpoint,
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
  // Returns true if this slot is fresh (not yet run), false if already ran.
  const { error } = await admin.from('cron_runs').insert({ job_name: jobName, slot_key: slotKey });
  if (error) {
    if (error.code === '23505') return false; // unique violation → already ran
    console.error('[dispatch-market] cron_runs insert error:', error.message);
  }
  return true;
}

export async function GET(req: NextRequest) {
  // Vercel calls crons with the x-vercel-cron header; CRON_SECRET is an additional guard.
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const hasBearerSecret = cronSecret ? auth === `Bearer ${cronSecret}` : false;

  if (!isVercelCron && !hasBearerSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const bucket = Math.floor(utcM / 15) * 15;
  const slotKey = `${utcH}:${bucket}`;
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const fullSlot = `${dateStr}:${slotKey}`;

  const jobs = SCHEDULE[slotKey] ?? [];
  console.log(`[dispatch-market] slot=${slotKey} date=${dateStr} jobs=${jobs.join(',') || 'none'}`);

  if (jobs.length === 0) {
    return NextResponse.json({ slot: slotKey, dispatched: [] });
  }

  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const results: Array<{ job: string; status: string; reason?: string }> = [];

  for (const job of jobs) {
    const fresh = await markRan(admin, job, fullSlot);
    if (!fresh) {
      console.log(`[dispatch-market] skip ${job} — already ran for slot ${fullSlot}`);
      results.push({ job, status: 'skipped', reason: 'already_ran' });
      continue;
    }

    const handler = HANDLERS[job];
    if (!handler) {
      console.error(`[dispatch-market] no handler for job: ${job}`);
      results.push({ job, status: 'error', reason: 'no_handler' });
      continue;
    }

    try {
      console.log(`[dispatch-market] dispatching ${job}`);
      const jobReq = makeCronRequest(req);
      const res = await handler(jobReq);
      const status = res.status >= 200 && res.status < 300 ? 'ok' : `http_${res.status}`;
      console.log(`[dispatch-market] ${job} → ${status}`);
      results.push({ job, status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[dispatch-market] ${job} threw:`, msg);
      results.push({ job, status: 'error', reason: msg });
    }
  }

  return NextResponse.json({ slot: slotKey, date: dateStr, dispatched: results });
}
