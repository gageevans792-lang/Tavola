import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AutopilotDecision {
  symbol:     string;
  action:     'buy' | 'sell' | 'hold';
  qty:        number;
  confidence: number;
  reasoning:  string;
  status:     'executed' | 'rejected' | 'skipped';
  order_id?:  string;
  error?:     string;
}

export interface AutopilotRun {
  id:             string;
  user_id:        string;
  run_at:         string;
  trades_executed: number;
  total_value:    number;
  market_outlook: string | null;
  summary:        string | null;
  decisions:      AutopilotDecision[];
  status:         string;
}

// ── GET: fetch autopilot run history ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = Math.min(
      Math.max(1, parseInt(limitParam ?? '20', 10) || 20),
      50,
    );

    const { data, error } = await supabase
      .from('autopilot_runs')
      .select('*')
      .eq('user_id', user.id)
      .order('run_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[autopilot/history GET]', error.message);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    return NextResponse.json({ runs: (data ?? []) as AutopilotRun[] });
  } catch (err: unknown) {
    console.error('[autopilot/history GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
