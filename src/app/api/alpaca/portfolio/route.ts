import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAccount,
  getPositions,
  getPortfolioHistory,
} from '@/lib/alpaca/client';
import { syncHoldingsToSupabase } from '@/lib/alpaca/sync';
import type { AlpacaPosition } from '@/types';

// Alpaca paper accounts start at $100,000
const PAPER_BASELINE = 100_000;

// Allocation colour palette — cycles if > 6 holdings
const ALLOC_COLORS = [
  '#0A1628', '#B8960C', '#4A5568',
  '#6B7280', '#94A3B8', '#CBD5E1',
];

// ── Shared types (imported by dashboard page) ─────────────────────────────────

export interface PortfolioData {
  equity:             number;
  last_equity:        number;
  cash:               number;
  buying_power:       number;
  long_market_value:  number;
  portfolio_value:    number;
  day_pl:             number;
  day_pl_pct:         number;
  total_return:       number;
  total_return_pct:   number;
  chart:              Array<{ date: string; value: number }>;
  allocation:         Array<{ name: string; value: number; color: string }>;
  holdings:           unknown[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAllocation(
  positions: AlpacaPosition[],
  portfolioValue: number,
): PortfolioData['allocation'] {
  if (positions.length === 0 || portfolioValue <= 0) return [];

  const slices = positions.map((p, i) => ({
    name:  p.symbol,
    value: (parseFloat(p.market_value) / portfolioValue) * 100,
    color: ALLOC_COLORS[i % ALLOC_COLORS.length],
  }));

  const main  = slices.filter((s) => s.value >= 3);
  const small = slices.filter((s) => s.value < 3);

  if (small.length > 0) {
    main.push({
      name:  'Other',
      value: small.reduce((acc, s) => acc + s.value, 0),
      color: ALLOC_COLORS[main.length % ALLOC_COLORS.length],
    });
  }

  return main;
}

function buildFlatChart(equity: number): PortfolioData['chart'] {
  return Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86_400_000).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    }),
    value: equity,
  }));
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // ── Fetch account + positions in parallel ─────────────────────────────────
    const [account, positions] = await Promise.all([
      getAccount(),
      getPositions(),
    ]);

    const equity          = parseFloat(account.equity);
    const lastEquity      = parseFloat(account.last_equity);
    const cash            = parseFloat(account.cash);
    const buyingPower     = parseFloat(account.buying_power);
    const longMarketValue = parseFloat(account.long_market_value ?? '0');
    const portValue       = parseFloat(account.portfolio_value) || equity;

    const dayPl          = equity - lastEquity;
    const dayPlPct       = lastEquity > 0 ? (dayPl / lastEquity) * 100 : 0;
    const totalReturn    = equity - PAPER_BASELINE;
    const totalReturnPct = (totalReturn / PAPER_BASELINE) * 100;

    // ── Sync Alpaca positions → Supabase holdings (fire-and-forget) ───────────
    syncHoldingsToSupabase(user.id).catch((err: unknown) => {
      console.warn('[portfolio] sync:', err instanceof Error ? err.message : err);
    });

    // ── Portfolio history → chart data (30-day daily) ─────────────────────────
    let chart: PortfolioData['chart'];
    try {
      const history = await getPortfolioHistory({ period: '1M', timeframe: '1D' });
      const timestamps = history.timestamp ?? [];
      const equities   = history.equity    ?? [];

      if (timestamps.length > 0) {
        chart = timestamps.map((ts, i) => ({
          date: new Date(ts * 1000).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric',
          }),
          // Filter out null/0 values at the start of history (pre-account-funding)
          value: equities[i] > 0 ? equities[i] : (equities.find((v) => v > 0) ?? equity),
        }));
      } else {
        chart = buildFlatChart(equity);
      }
    } catch (histErr) {
      console.warn(
        '[portfolio] getPortfolioHistory failed:',
        histErr instanceof Error ? histErr.message : histErr,
      );
      chart = buildFlatChart(equity);
    }

    // ── Allocation from live positions ────────────────────────────────────────
    const allocation = buildAllocation(positions, portValue);

    return NextResponse.json({
      equity,
      last_equity:        lastEquity,
      cash,
      buying_power:       buyingPower,
      long_market_value:  longMarketValue,
      portfolio_value:    portValue,
      day_pl:             dayPl,
      day_pl_pct:         dayPlPct,
      total_return:       totalReturn,
      total_return_pct:   totalReturnPct,
      chart,
      allocation,
      holdings:           [],
    } satisfies PortfolioData);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch portfolio';
    console.error('[portfolio]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
