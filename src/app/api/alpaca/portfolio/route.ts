import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  getAccount,
  getPositions,
  getPortfolioHistory,
  getTickerPrices,
} from '@/lib/alpaca/client';
import { isFounder } from '@/lib/founder';
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

// ── Simulated portfolio (non-founder) ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildSimulatedPortfolio(
  userId:        string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
): Promise<NextResponse> {
  const BASELINE = 100_000;
  const today    = new Date().toISOString().slice(0, 10);

  // 1. Get cash balance.
  // SAFETY: if the user has synced holdings but NO user_accounts row, they are
  // almost certainly the founder accessed with FOUNDER_USER_ID env var missing.
  // Return a safe flat baseline rather than mixing real Alpaca data with simulated cash.
  const { data: acctRow } = await supabaseAdmin
    .from('user_accounts')
    .select('cash')
    .eq('user_id', userId)
    .maybeSingle() as { data: { cash: number } | null };

  if (!acctRow) {
    const { data: existingHoldings } = await supabaseAdmin
      .from('holdings')
      .select('ticker')
      .eq('user_id', userId)
      .limit(1);

    if (existingHoldings && existingHoldings.length > 0) {
      console.warn(
        '[portfolio/simulated] User has holdings but no user_accounts — FOUNDER_USER_ID env var may be unset. Returning baseline to prevent data mixing.',
      );
      return NextResponse.json({
        equity: BASELINE, last_equity: BASELINE, cash: BASELINE,
        buying_power: BASELINE, long_market_value: 0, portfolio_value: BASELINE,
        day_pl: 0, day_pl_pct: 0, total_return: 0, total_return_pct: 0,
        chart: buildFlatChart(BASELINE), allocation: [], holdings: [], positions_synced: 0,
      } satisfies PortfolioData);
    }

    // New simulated user — initialise account row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from('user_accounts') as any).insert({ user_id: userId, cash: BASELINE });
  }

  const cash = acctRow ? Number(acctRow.cash) : BASELINE;

  // 2. Get holdings
  const { data: rawHoldings } = await supabaseAdmin
    .from('holdings')
    .select('*')
    .eq('user_id', userId)
    .order('market_value', { ascending: false });

  let holdings: SyncedHolding[] = (rawHoldings ?? []) as SyncedHolding[];

  // 3. Refresh live prices if there are holdings
  if (holdings.length > 0) {
    try {
      const tickers = holdings.map((h) => h.ticker);
      const prices  = await getTickerPrices(tickers);

      let totalMv = 0;
      for (const h of holdings) {
        const info = prices[h.ticker];
        if (info && !info.price_unavailable && info.price > 0) {
          const price  = info.price;
          const mv     = h.qty * price;
          const upl    = (price - h.avg_entry_price) * h.qty;
          const uplpc  = h.avg_entry_price > 0
            ? ((price - h.avg_entry_price) / h.avg_entry_price) * 100
            : 0;
          totalMv += mv;

          await supabaseAdmin.from('holdings').update({
            current_price:   price,
            market_value:    mv,
            unrealized_pl:   upl,
            unrealized_plpc: uplpc,
            updated_at:      new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('ticker', h.ticker);

          h.current_price   = price;
          h.market_value    = mv;
          h.unrealized_pl   = upl;
          h.unrealized_plpc = uplpc;
        } else {
          totalMv += h.market_value;
        }
      }

      // Refresh weight_pct now that we have totalMv
      const portfolioValue = cash + totalMv;
      for (const h of holdings) {
        const wt = portfolioValue > 0 ? (h.market_value / portfolioValue) * 100 : 0;
        h.weight_pct = wt;
        await supabaseAdmin.from('holdings').update({ weight_pct: wt })
          .eq('user_id', userId)
          .eq('ticker', h.ticker);
      }

      // Re-fetch after updates
      const { data: fresh } = await supabaseAdmin
        .from('holdings')
        .select('*')
        .eq('user_id', userId)
        .order('market_value', { ascending: false });
      if (fresh) holdings = fresh as SyncedHolding[];
    } catch (err) {
      console.warn('[portfolio/simulated] price refresh failed (non-fatal):', err instanceof Error ? err.message : err);
    }
  }

  const longMarketValue = holdings.reduce((s, h) => s + h.market_value, 0);
  const portfolioValue  = cash + longMarketValue;

  // 4. Yesterday's equity for day P&L
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const { data: yesterdayRow } = await supabaseAdmin
    .from('equity_history')
    .select('value')
    .eq('user_id', userId)
    .eq('date', yesterday)
    .maybeSingle();
  const lastEquity = yesterdayRow ? Number(yesterdayRow.value) : BASELINE;

  const dayPl          = portfolioValue - lastEquity;
  const dayPlPct       = lastEquity > 0 ? (dayPl / lastEquity) * 100 : 0;
  const totalReturn    = portfolioValue - BASELINE;
  const totalReturnPct = (totalReturn / BASELINE) * 100;

  // 5. Upsert today's equity snapshot (max once per day, non-blocking)
  supabaseAdmin.from('equity_history').upsert(
    { user_id: userId, date: today, value: portfolioValue },
    { onConflict: 'user_id,date' },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ).then(({ error }: { error: any }) => {
    if (error) console.warn('[portfolio/simulated] equity_history upsert:', error.message);
  });

  // 6. Allocation pie
  const allocation: PortfolioData['allocation'] = [];
  if (holdings.length > 0 && portfolioValue > 0) {
    const slices = holdings.map((h, i) => ({
      name:  h.ticker,
      value: (h.market_value / portfolioValue) * 100,
      color: ALLOC_COLORS[i % ALLOC_COLORS.length],
    }));
    const main  = slices.filter((s) => s.value >= 3);
    const small = slices.filter((s) => s.value < 3);
    if (small.length > 0) {
      main.push({
        name:  'Other',
        value: small.reduce((a, s) => a + s.value, 0),
        color: ALLOC_COLORS[main.length % ALLOC_COLORS.length],
      });
    }
    allocation.push(...main);
  }

  return NextResponse.json({
    equity:            portfolioValue,
    last_equity:       lastEquity,
    cash,
    buying_power:      cash,
    long_market_value: longMarketValue,
    portfolio_value:   portfolioValue,
    day_pl:            dayPl,
    day_pl_pct:        dayPlPct,
    total_return:      totalReturn,
    total_return_pct:  totalReturnPct,
    chart:             buildFlatChart(portfolioValue),
    allocation,
    holdings,
    positions_synced:  holdings.length,
  } satisfies PortfolioData);
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

  // ── Non-founder: compute portfolio from DB (no Alpaca account access) ───────
  if (!isFounder(user.id)) {
    return buildSimulatedPortfolio(user.id, supabaseAdmin);
  }

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
        .not('ticker', 'in', `(${currentTickers.join(',')})`);

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
