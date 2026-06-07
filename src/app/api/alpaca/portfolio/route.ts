import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAccount,
  getPositions,
  getPortfolioHistory,
} from '@/lib/alpaca/client';
import { syncHoldingsToSupabase } from '@/lib/alpaca/sync';
import type { SyncedHolding } from '@/lib/alpaca/sync';
import type { AlpacaPosition } from '@/types';

const PAPER_BASELINE = 100_000;

const ALLOC_COLORS = [
  '#0A1628', '#B8960C', '#4A5568',
  '#6B7280', '#94A3B8', '#CBD5E1',
];

// ── Shared types (imported by dashboard + holdings pages) ──────────────────────

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
  holdings:           SyncedHolding[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Race a promise against a deadline; throws with a descriptive message on timeout
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

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

  // ── Step 1: Fetch Alpaca account (required — bail if this fails) ─────────────
  console.log('[portfolio] Fetching Alpaca account...');
  let account: Awaited<ReturnType<typeof getAccount>>;
  try {
    account = await withTimeout(getAccount(), 10_000, 'getAccount');
    console.log('[portfolio] Account fetched: equity =', account.equity);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[portfolio] getAccount failed:', msg);
    return NextResponse.json({ error: `Alpaca account unavailable: ${msg}` }, { status: 503 });
  }

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

  // ── Step 2: Fetch positions (non-fatal — degrade gracefully) ─────────────────
  console.log('[portfolio] Fetching positions...');
  let positions: AlpacaPosition[] = [];
  try {
    positions = await withTimeout(getPositions(), 10_000, 'getPositions');
    console.log('[portfolio] Positions fetched:', positions.length);
  } catch (err) {
    console.warn('[portfolio] getPositions failed (continuing):', err instanceof Error ? err.message : err);
  }

  // ── Step 3: Sync to Supabase (non-fatal) ─────────────────────────────────────
  let holdings: SyncedHolding[] = [];
  try {
    holdings = await withTimeout(
      syncHoldingsToSupabase(user.id, positions, portValue),
      10_000,
      'syncHoldings',
    );
  } catch (err) {
    console.warn('[portfolio] sync failed (continuing):', err instanceof Error ? err.message : err);
  }

  // ── Step 4: Portfolio history → chart (non-fatal) ─────────────────────────────
  let chart: PortfolioData['chart'];
  try {
    const history = await withTimeout(
      getPortfolioHistory({ period: '1M', timeframe: '1D' }),
      10_000,
      'getPortfolioHistory',
    );
    const timestamps = history.timestamp ?? [];
    const equities   = history.equity    ?? [];
    const firstNonZero = equities.find((v) => v > 0) ?? equity;

    if (timestamps.length > 0) {
      chart = timestamps.map((ts, i) => ({
        date:  new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: equities[i] > 0 ? equities[i] : firstNonZero,
      }));
    } else {
      chart = buildFlatChart(equity);
    }
  } catch (err) {
    console.warn('[portfolio] getPortfolioHistory failed (using flat chart):', err instanceof Error ? err.message : err);
    chart = buildFlatChart(equity);
  }

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
    holdings,
  } satisfies PortfolioData);
}
