import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getPositions } from '@/lib/alpaca/client';

// ── Admin supabase client (service role) ──────────────────────────────────────

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(val: number): string {
  return Math.abs(val * 100).toFixed(1);
}

// ── GET handler (Vercel cron calls GET) ───────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. Verify cron secret — fail closed; never run unprotected
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') ?? '';
  if (!cronSecret || cronSecret.length === 0 || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // 2. Fetch all user ids from profiles where onboarding_completed = true
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('onboarding_completed', true)
      .limit(50);

    if (profilesError) {
      console.error('[alerts/monitor] profiles error:', profilesError.message);
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
    }

    const userIds = (profiles ?? []).map((p: { id: string }) => p.id);

    let alertsGenerated = 0;
    const usersProcessed = userIds.length;

    // Today's date string for deduplication
    const todayStr = new Date().toISOString().slice(0, 10);

    // 3. Fetch positions once (shared Alpaca account in paper mode)
    let positions: Awaited<ReturnType<typeof getPositions>> = [];
    try {
      positions = await getPositions();
    } catch (err) {
      console.error('[alerts/monitor] positions error:', err instanceof Error ? err.message : err);
    }

    // Check VIXY for VIX proxy
    const vixyPosition = positions.find((p) => p.symbol === 'VIXY');
    const vixyPrice = vixyPosition ? parseFloat(vixyPosition.current_price) : 0;

    // 4. For each user, compute alerts
    for (const userId of userIds) {
      const notificationsToInsert: Array<{
        user_id: string;
        type: string;
        title: string;
        message: string;
        ticker: string | null;
      }> = [];

      for (const pos of positions) {
        const changePct = parseFloat(pos.change_today); // decimal like 0.05

        // Risk alert: day change < -5%
        if (changePct < -0.05) {
          const pct = fmtPct(changePct);
          notificationsToInsert.push({
            user_id: userId,
            type:    'risk',
            title:   `Risk Alert: ${pos.symbol} dropped ${pct}%`,
            message: `Your ${pos.symbol} position dropped ${pct}% today. Tavola AI is monitoring and will adjust if needed.`,
            ticker:  pos.symbol,
          });
        }

        // Profit alert: day change > +8%
        if (changePct > 0.08) {
          const pct = fmtPct(changePct);
          notificationsToInsert.push({
            user_id: userId,
            type:    'profit',
            title:   `Profit Alert: ${pos.symbol} up ${pct}%`,
            message: `Consider taking partial gains on ${pos.symbol}, which is up ${pct}% today.`,
            ticker:  pos.symbol,
          });
        }
      }

      // VIX proxy alert (VIXY > 25)
      if (vixyPrice > 25) {
        notificationsToInsert.push({
          user_id: userId,
          type:    'market',
          title:   'Market Alert: Volatility Rising',
          message: 'Market volatility is elevated. Tavola AI is monitoring your portfolio and ready to act.',
          ticker:  null,
        });
      }

      // 5. Deduplicate and insert
      for (const notif of notificationsToInsert) {
        // Check if same user+ticker+type already exists today
        const { count } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', notif.user_id)
          .eq('type', notif.type)
          .eq('ticker', notif.ticker ?? '')
          .gte('created_at', `${todayStr}T00:00:00Z`);

        if ((count ?? 0) === 0) {
          await supabase.from('notifications').insert(notif);
          alertsGenerated++;
        }
      }
    }

    return NextResponse.json({ alerts_generated: alertsGenerated, users_processed: usersProcessed });
  } catch (err: unknown) {
    console.error('[alerts/monitor]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
