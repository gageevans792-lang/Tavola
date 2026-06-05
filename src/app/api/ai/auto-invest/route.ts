import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAccount, getPositions, getSnapshots, placeMarketOrder } from '@/lib/alpaca/client';
import { analyzePortfolio } from '@/lib/ai/analyzer';
import { applyRiskGuard } from '@/lib/ai/risk-guard';
import type { AutoInvestConfig, AutoInvestResult, ExecutedRecommendation } from '@/types';

const DEFAULT_CONFIG: AutoInvestConfig = {
  mode: 'review',
  max_position_pct: 0.05,
  confidence_threshold: 70,
  max_trade_value: 2000,
  watchlist: [],
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const config: AutoInvestConfig = {
    mode:                 body.mode                 ?? DEFAULT_CONFIG.mode,
    max_position_pct:     body.max_position_pct     ?? DEFAULT_CONFIG.max_position_pct,
    confidence_threshold: body.confidence_threshold ?? DEFAULT_CONFIG.confidence_threshold,
    max_trade_value:      body.max_trade_value      ?? DEFAULT_CONFIG.max_trade_value,
    watchlist:            body.watchlist            ?? DEFAULT_CONFIG.watchlist,
  };

  try {
    // ── 1. Fetch Alpaca account + positions ──────────────────────────────────
    const [account, positions] = await Promise.all([getAccount(), getPositions()]);

    const portfolioValue = parseFloat(account.equity);
    const availableCash  = parseFloat(account.cash);

    // ── 2. Fetch live market data ────────────────────────────────────────────
    const heldSymbols  = positions.map((p) => p.symbol);
    const watchSymbols = config.watchlist.filter((s) => !heldSymbols.includes(s));
    const snapshots    = await getSnapshots([...heldSymbols, ...watchSymbols]);

    // ── 3. Build position context for Claude ─────────────────────────────────
    const positionContexts = positions.map((p) => {
      const snap = snapshots[p.symbol];
      const price    = snap?.latestTrade?.p ?? parseFloat(p.current_price);
      const prevClose = snap?.prevDailyBar?.c ?? price;
      return {
        symbol:            p.symbol,
        qty:               parseFloat(p.qty),
        avg_entry:         parseFloat(p.avg_entry_price),
        current_price:     price,
        market_value:      parseFloat(p.market_value),
        unrealized_pl_pct: parseFloat(p.unrealized_plpc),
        daily_change_pct:  prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
      };
    });

    const watchlistPrices: Record<string, number> = {};
    for (const sym of watchSymbols) {
      const snap = snapshots[sym];
      if (snap) watchlistPrices[sym] = snap.latestTrade?.p ?? snap.minuteBar?.c ?? 0;
    }

    // ── 4. Fetch user risk profile ───────────────────────────────────────────
    const { data: riskProfile } = await supabase
      .from('risk_profiles')
      .select('level')
      .eq('user_id', user.id)
      .maybeSingle();

    // ── 5. Call Claude for structured analysis ───────────────────────────────
    const analysis = await analyzePortfolio({
      cash:             availableCash,
      portfolio_value:  portfolioValue,
      positions:        positionContexts,
      watchlist:        config.watchlist,
      watchlist_prices: watchlistPrices,
      risk_level:       riskProfile?.level ?? 'balanced',
      investment_goal:  '',
    });

    // ── 6. Apply risk guard ──────────────────────────────────────────────────
    const currentPositionValues: Record<string, number> = {};
    for (const p of positions) {
      currentPositionValues[p.symbol] = parseFloat(p.market_value);
    }

    const latestPrices: Record<string, number> = {};
    for (const [sym, snap] of Object.entries(snapshots)) {
      latestPrices[sym] = snap.latestTrade?.p ?? snap.minuteBar?.c ?? 0;
    }

    const { approved, rejected } = applyRiskGuard(analysis.recommendations, config, {
      portfolioValue,
      availableCash,
      currentPositionValues,
      latestPrices,
    });

    // ── 7. Execute trades (auto mode only) ───────────────────────────────────
    const executed: ExecutedRecommendation[] = [];
    const errors: string[] = [];

    if (config.mode === 'auto') {
      for (const rec of approved) {
        if (rec.action === 'hold') continue;
        try {
          const order = await placeMarketOrder(rec.symbol, rec.action, rec.qty);
          await supabase.from('trades').insert({
            user_id:          user.id,
            ticker:           rec.symbol,
            side:             rec.action,
            qty:              rec.qty,
            alpaca_order_id:  order.id,
            ai_reasoning:     rec.reasoning,
            confidence_score: rec.confidence,
            status:           'pending',
          });
          executed.push({ ...rec, order_id: order.id });
        } catch (err: unknown) {
          errors.push(`${rec.symbol}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }

    // ── 8. Persist AI insights ───────────────────────────────────────────────
    const executedSymbols = new Set(executed.map((e) => e.symbol));
    const insightRows = analysis.recommendations
      .filter((r) => r.action !== 'hold')
      .map((rec) => ({
        user_id:          user.id,
        type:             rec.action as 'buy' | 'sell',
        ticker:           rec.symbol,
        message:          rec.reasoning,
        confidence_score: rec.confidence,
        executed:         executedSymbols.has(rec.symbol),
      }));

    if (insightRows.length > 0) {
      await supabase.from('ai_insights').insert(insightRows);
    }

    // ── 9. Return result ─────────────────────────────────────────────────────
    const result: AutoInvestResult = {
      analysis,
      approved: config.mode === 'review' ? approved : [],
      executed,
      rejected,
      errors,
      portfolio: { value: portfolioValue, cash: availableCash },
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[auto-invest]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
