import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTickerPrices } from '@/lib/alpaca/client';

interface DecisionRow {
  id: string;
  symbol: string;
  action: string;
  confidence: number;
  reasoning_summary: string | null;
  price_at_decision: number | null;
  estimated_value: number | null;
  executed: boolean;
  created_at: string;
  session_type: string;
}

interface DecisionWithOutcome extends DecisionRow {
  current_price: number | null;
  return_pct: number | null;
  outcome: 'win' | 'loss' | 'neutral' | 'pending';
  days_since: number;
}

interface AttributionSummary {
  total_decisions: number;
  executed_decisions: number;
  win_rate: number;
  avg_confidence: number;
  best_call: DecisionWithOutcome | null;
  worst_call: DecisionWithOutcome | null;
  decisions: DecisionWithOutcome[];
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: decisions, error } = await supabase
      .from('ai_decisions')
      .select('id, symbol, action, confidence, reasoning_summary, price_at_decision, estimated_value, executed, created_at, session_type')
      .eq('user_id', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    if (!decisions?.length) {
      return NextResponse.json({
        total_decisions: 0,
        executed_decisions: 0,
        win_rate: 0,
        avg_confidence: 0,
        best_call: null,
        worst_call: null,
        decisions: [],
      } satisfies AttributionSummary);
    }

    // Fetch current prices for all unique symbols
    const symbols = [...new Set(decisions.map(d => d.symbol))];
    let prices: Record<string, number> = {};
    try {
      const priceData = await getTickerPrices(symbols);
      prices = Object.fromEntries(
        Object.entries(priceData).map(([sym, data]) => [sym, data.price])
      );
    } catch { /* non-fatal — use null prices */ }

    const now = Date.now();
    const withOutcomes: DecisionWithOutcome[] = decisions.map(d => {
      const currentPrice = prices[d.symbol] ?? null;
      const daysSince = Math.round((now - new Date(d.created_at).getTime()) / 86_400_000);

      let returnPct: number | null = null;
      let outcome: DecisionWithOutcome['outcome'] = 'pending';

      if (currentPrice && d.price_at_decision && daysSince >= 1) {
        const rawReturn = (currentPrice - d.price_at_decision) / d.price_at_decision * 100;
        returnPct = Math.round(rawReturn * 10) / 10;

        // A "win" means the AI's directional call was correct
        if (d.action === 'buy') {
          outcome = rawReturn > 1 ? 'win' : rawReturn < -1 ? 'loss' : 'neutral';
        } else if (d.action === 'sell') {
          outcome = rawReturn < -1 ? 'win' : rawReturn > 1 ? 'loss' : 'neutral';
        } else {
          outcome = 'neutral';
        }
      }

      return { ...d, current_price: currentPrice, return_pct: returnPct, outcome, days_since: daysSince };
    });

    const scoreable = withOutcomes.filter(d => d.outcome !== 'pending');
    const wins = scoreable.filter(d => d.outcome === 'win');
    const winRate = scoreable.length > 0 ? Math.round((wins.length / scoreable.length) * 100) : 0;
    const avgConfidence = decisions.length > 0
      ? Math.round(decisions.reduce((s, d) => s + (d.confidence ?? 0), 0) / decisions.length)
      : 0;

    const sorted = [...scoreable].sort((a, b) => (b.return_pct ?? 0) - (a.return_pct ?? 0));
    const bestCall = sorted.find(d => d.action === 'buy') ?? sorted[0] ?? null;
    const worstCall = sorted.findLast(d => d.action === 'buy') ?? sorted[sorted.length - 1] ?? null;

    return NextResponse.json({
      total_decisions: decisions.length,
      executed_decisions: decisions.filter(d => d.executed).length,
      win_rate: winRate,
      avg_confidence: avgConfidence,
      best_call: bestCall,
      worst_call: worstCall,
      decisions: withOutcomes.slice(0, 50),
    } satisfies AttributionSummary);
  } catch (err) {
    console.error('[ai/attribution] GET:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const b = body as Record<string, unknown>;
    if (!b.symbol || !b.action || !b.session_type) {
      return NextResponse.json({ error: 'symbol, action, and session_type are required' }, { status: 400 });
    }

    const { error } = await supabase.from('ai_decisions').insert({
      user_id:           user.id,
      session_type:      b.session_type,
      symbol:            b.symbol,
      action:            b.action,
      qty:               b.qty ?? null,
      confidence:        b.confidence ?? null,
      reasoning_summary: b.reasoning_summary ?? null,
      price_at_decision: b.price_at_decision ?? null,
      estimated_value:   b.estimated_value ?? null,
      risk_level:        b.risk_level ?? null,
      executed:          b.executed ?? false,
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[ai/attribution] POST:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
