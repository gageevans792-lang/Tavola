import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { render } from '@react-email/components';
import { DailyBriefingEmail } from '@/lib/email/templates/DailyBriefing';
import { getResendClient } from '@/lib/resend/client';
import * as React from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function formatDateLong(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

// ── Core send function ────────────────────────────────────────────────────────

async function sendDailyBriefingEmail(date: string) {
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch briefing
  const { data: briefing, error } = await supabaseAdmin
    .from('daily_briefings')
    .select('*')
    .eq('briefing_date', date)
    .maybeSingle();

  if (error) throw new Error(`DB fetch failed: ${error.message}`);
  if (!briefing) throw new Error(`No briefing found for ${date}`);

  // Skip if already sent
  if (briefing.email_sent) {
    return { skipped: true, reason: 'already sent' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tavola.finance';
  const dateLabel = formatDateLong(date);
  const subject   = `Tavola Daily Strategy: ${dateLabel}`;

  // Render email to HTML
  const html = await render(
    React.createElement(DailyBriefingEmail, {
      date:    dateLabel,
      buys:    briefing.buys  as Array<{ ticker: string; thesis: string; confidence: number }>,
      avoids:  briefing.avoids as Array<{ ticker: string; thesis: string; confidence: number }>,
      outlook: briefing.outlook,
      appUrl,
    }),
  );

  // Send via Resend
  const resend = getResendClient();
  const { data: sendData, error: sendError } = await resend.emails.send({
    from:    'notifications@tavola.finance',
    to:      'gage@tavola.finance',
    subject,
    html,
  });

  if (sendError) throw new Error(`Resend error: ${sendError.message}`);

  // Mark as sent
  await supabaseAdmin
    .from('daily_briefings')
    .update({
      email_sent:    true,
      email_sent_at: new Date().toISOString(),
    })
    .eq('briefing_date', date);

  return { sent: true, email_id: sendData?.id };
}

// ── GET: cron trigger OR manual send ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const isCron = req.headers.get('x-vercel-cron') === '1';
  const date   = req.nextUrl.searchParams.get('date') ?? todayET();

  if (isCron) {
    try {
      const result = await sendDailyBriefingEmail(date);
      return NextResponse.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[send-daily-briefing] cron error:', msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Manual trigger — require user auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY is not configured. Add it to your environment variables.' },
      { status: 503 },
    );
  }

  try {
    const result = await sendDailyBriefingEmail(date);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[send-daily-briefing]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
