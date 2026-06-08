import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  getAccount,
  getPositions,
  getPortfolioHistory,
} from '@/lib/alpaca/client';
import type { SyncedHolding } from '@/lib/alpaca/sync';
import type { AlpacaPosition } from '@/types';

const PAPER_BASELINE = 100_000;

const ALLOC_COLORS = [
  '#0A1628', '#B8960C', '#4A5568',
  '#6B7280', '#94A3B8', '#CBD5E1',
];

// ── Shared types (imported by dashboard + holdings pages) ─────────────────────

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
  positions_synced:   number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── Step 1: Fetch Alpaca account (required) ──────────────────────────────────
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

  // ── Step 2: Fetch positions ──────────────────────────────────────────────────
  console.log('[portfolio] Fetching positions...');
  let positions: AlpacaPosition[] = [];
  try {
    positions = await withTimeout(getPositions(), 10_000, 'getPositions');
    console.log('[portfolio] Positions fetched:', positions.length);
  } catch (err) {
    console.warn('[portfolio] getPositions failed (continuing):', err instanceof Error ? err.message : err);
  }

  // ── Step 3: Upsert positions to Supabase via service role ────────────────────
  console.log('[portfolio] Syncing', positions.length, 'positions to Supabase for user', user.id);
  let holdings: SyncedHolding[] = [];

  try {
    if (positions.length > 0) {
      for (const pos of positions) {
        const mv = parseFloat(pos.market_value);
        const row = {
          user_id:         user.id,
          ticker:          pos.symbol,
          name:            pos.symbol,
          qty:             parseFloat(pos.qty),
          avg_entry_price: parseFloat(pos.avg_entry_price),
          current_price:   parseFloat(pos.current_price || pos.avg_entry_price),
          market_value:    mv,
          unrealized_pl:   parseFloat(pos.unrealized_pl || '0'),
          unrealized_plpc: parseFloat(pos.unrealized_plpc || '0') * 100,
          weight_pct:      portValue > 0 ? (mv / portValue) * 100 : 0,
          updated_at:      new Date().toISOString(),
        };
        console.log('[portfolio] upserting', pos.symbol, 'qty=', row.qty, 'market_value=', row.market_value);

        const { error: upsertErr } = await supabaseAdmin
          .from('holdings')
          .upsert(row, { onConflict: 'user_id,ticker' });

        if (upsertErr) {
          console.error('[portfolio] upsert failed for', pos.symbol, ':', upsertErr.message);
        } else {
          console.log('[portfolio] upserted', pos.symbol, 'OK');
        }
      }

      // Delete holdings no longer in Alpaca positions
      const currentTickers = positions.map((p) => p.symbol);
      const { error: deleteErr } = await supabaseAdmin
        .from('holdings')
        .delete()
        .eq('user_id', user.id)
        .not('ticker', 'in', `(${currentTickers.map((t) => `"${t}"`).join(',')})`);

      if (deleteErr) {
        console.warn('[portfolio] stale delete failed (non-fatal):', deleteErr.message);
      } else {
        console.log('[portfolio] stale holdings deleted');
      }
    } else {
      console.log('[portfolio] No positions — wiping holdings for user', user.id);
      await supabaseAdmin.from('holdings').delete().eq('user_id', user.id);
    }

    // Fetch the now-fresh holdings from Supabase
    const { data: freshData, error: fetchErr } = await supabaseAdmin
      .from('holdings')
      .select('*')
      .eq('user_id', user.id)
      .order('market_value', { ascending: false });

    if (fetchErr) {
      console.error('[portfolio] holdings fetch failed:', fetchErr.message);
    } else {
      holdings = (freshData ?? []) as SyncedHolding[];
      console.log('[portfolio] fresh holdings loaded:', holdings.length);
    }
  } catch (err) {
    console.error('[portfolio] sync block threw:', err instanceof Error ? err.message : err);
  }

  // ── Step 4: Portfolio history → chart (non-fatal) ────────────────────────────
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

    chart = timestamps.length > 0
      ? timestamps.map((ts, i) => ({
          date:  new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: equities[i] > 0 ? equities[i] : firstNonZero,
        }))
      : buildFlatChart(equity);
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
    positions_synced:   positions.length,
  } satisfies PortfolioData);
}
