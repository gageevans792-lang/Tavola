import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { getAccount, getPositions, getTickerPrices, placeMarketOrder } from '@/lib/alpaca/client';
import type { TickerPrice } from '@/lib/alpaca/client';
import { anthropic } from '@/lib/anthropic/client';
import { applyRiskGuard } from '@/lib/ai/risk-guard';
import { getMacroContext, buildMacroPromptSection } from '@/lib/macro/client';
import type { AlpacaPosition, AutoInvestConfig, TradeRecommendation } from '@/types';
import type { AutopilotDecision, AutopilotRun } from '../history/route';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TradeResult {
  symbol:   string;
  action:   'buy' | 'sell';
  qty:      number;
  status:   'executed' | 'failed';
  order_id?: string;
  error?:   string;
}

// ── Tool schema (mirrors analyze route) ───────────────────────────────────────

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_portfolio_analysis',
  description:
    'Submit a complete, structured portfolio analysis with specific trade recommendations. You MUST call this tool — do not reply in plain text.',
  input_schema: {
    type: 'object' as const,
    required: ['recommendations', 'market_outlook', 'summary'],
    properties: {
      recommendations: {
        type: 'array',
        description: 'Trade recommendations for the portfolio.',
        items: {
          type: 'object',
          required: ['ticker', 'action', 'qty', 'confidence', 'reasoning', 'risk_level'],
          properties: {
            ticker:     { type: 'string', description: 'Uppercase ticker symbol' },
            action:     { type: 'string', enum: ['buy', 'sell', 'hold'] },
            qty:        { type: 'number', minimum: 0, description: 'Shares to buy/sell; 0 for hold' },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            reasoning:  { type: 'string' },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
      market_outlook: { type: 'string' },
      summary:        { type: 'string' },
    },
  },
};

// ── Portfolio text builder ────────────────────────────────────────────────────

function buildPortfolioText(
  equity: number,
  buyingPower: number,
  cash: number,
  positions: AlpacaPosition[],
  prices: Record<string, TickerPrice>,
  watchlistTickers: string[],
): string {
  const posLines = positions.length
    ? positions.map((p) => {
        const info   = prices[p.symbol];
        const price  = info?.price > 0 ? info.price : parseFloat(p.current_price);
        const uPl    = parseFloat(p.unrealized_pl);
        const uPlPc  = parseFloat(p.unrealized_plpc) * 100;
        return (
          `  ${p.symbol.padEnd(6)} ` +
          `qty=${p.qty}  entry=$${parseFloat(p.avg_entry_price).toFixed(2)}  ` +
          `price=$${price.toFixed(2)}  ` +
          `mktval=$${parseFloat(p.market_value).toFixed(0)}  ` +
          `unrPL=${uPl >= 0 ? '+' : ''}$${uPl.toFixed(0)} (${uPlPc >= 0 ? '+' : ''}${uPlPc.toFixed(1)}%)`
        );
      }).join('\n')
    : '  (no open positions)';

  const watchOnly = watchlistTickers.filter(
    (t) => !positions.find((p) => p.symbol === t),
  );
  const watchLines = watchOnly.length
    ? watchOnly.map((t) => {
        const info  = prices[t];
        const price = info?.price ?? 0;
        return `  ${t.padEnd(6)} price=${price > 0 ? `$${price.toFixed(2)}` : 'N/A'}`;
      }).join('\n')
    : '  (empty)';

  return `ACCOUNT
=======
Equity:        $${equity.toFixed(2)}
Buying power:  $${buyingPower.toFixed(2)}
Cash:          $${cash.toFixed(2)}
Invested:      $${(equity - cash).toFixed(2)}

CURRENT POSITIONS
=================
${posLines}

WATCHLIST (candidate buys only)
================================
${watchLines}`;
}

// ── Next run timestamp ────────────────────────────────────────────────────────

function computeNextRunAt(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    default: // weekly
      now.setDate(now.getDate() + 7);
  }
  return now.toISOString();
}

// ── POST: trigger autopilot run ───────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ── 1. Load autopilot settings (non-fatal — table may not exist yet) ──────────
    let settings = { enabled: true, frequency: 'daily', max_trade_size: 5000 };
    try {
      const { data: settingsRow } = await supabase
        .from('autopilot_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (settingsRow) {
        settings = {
          enabled:        settingsRow.enabled ?? true,
          frequency:      settingsRow.frequency ?? 'daily',
          max_trade_size: settingsRow.max_trade_size ?? 5000,
        };
      }
    } catch {
      // Table missing — proceed with defaults
    }
    // If the user explicitly triggered this endpoint, treat as enabled regardless of DB
    // (localStorage state is the source of truth for enabled)

    // ── 2. Fetch Alpaca account + positions ────────────────────────────────────
    const [account, positions, macroCtx] = await Promise.all([
      getAccount(),
      getPositions(),
      getMacroContext().catch(() => null),
    ]);

    const equity      = parseFloat(account.equity);
    const buyingPower = parseFloat(account.buying_power);
    const cash        = parseFloat(account.cash);

    // ── 3. Fetch watchlist (fall back to diversified ETF/index universe) ──────────
    const DEFAULT_UNIVERSE = [
      'VTI',  // Vanguard Total Stock Market
      'VOO',  // Vanguard S&P 500
      'QQQ',  // Nasdaq-100
      'SPY',  // S&P 500
      'IWM',  // Russell 2000 small-cap
      'VEA',  // Developed Markets ex-US
      'VWO',  // Emerging Markets
      'BND',  // US Total Bond Market
      'GLD',  // Gold
      'SCHD', // US Dividend Equity
      'VGT',  // Information Technology
      'ARKK', // ARK Innovation
    ];
    let watchlistTickers: string[] = [];
    try {
      const { data: wl } = await supabase
        .from('user_watchlist')
        .select('ticker')
        .eq('user_id', user.id);
      if (wl && wl.length > 0) {
        watchlistTickers = wl.map((r: { ticker: string }) => r.ticker);
      }
    } catch {
      // continue
    }
    // Always include the default ETF universe so Claude has something to work with
    watchlistTickers = [...new Set([...watchlistTickers, ...DEFAULT_UNIVERSE])];

    // ── 4. Fetch prices ────────────────────────────────────────────────────────
    const heldTickers = positions.map((p) => p.symbol);
    const allTickers  = [...new Set([...heldTickers, ...watchlistTickers])];
    const prices      = await getTickerPrices(allTickers);

    // ── 5. Build portfolio snapshot and call Claude ────────────────────────────
    const portfolioText = buildPortfolioText(
      equity, buyingPower, cash, positions, prices, watchlistTickers,
    );

    const macroSection = macroCtx ? buildMacroPromptSection(macroCtx) : '';

    const response = await anthropic.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 2048,
      system: `${macroSection}
You are an automated portfolio manager building a diversified long-term portfolio using ETFs and index funds.

Strategy: Core-satellite. Build a diversified core (VTI, VOO, BND, VEA, VWO) and add satellite positions in sector ETFs (VGT, SCHD, QQQ, IWM) and alternatives (GLD) based on market conditions.

Rules:
• Prefer broad market ETFs for new capital — avoid concentration in any single sector
• Only recommend BUY for tickers in the candidate list provided
• Only recommend SELL for tickers currently held; only sell if the position is overweight (>25% of portfolio) or significantly underperforming
• Set qty=0 for hold
• Only recommend buy/sell when confidence ≥ 65
• Buy notional (qty × price) must not exceed $${settings.max_trade_size} per trade
• A single position must not exceed 25% of total equity after the trade
• Target 5–8 holdings for a well-diversified portfolio
• If buying power is available, ALWAYS find at least one buy to deploy capital efficiently
• Do not recommend cumulative buys exceeding available buying power
• Provide 2–3 sentence reasoning per recommendation referencing the portfolio data
• You MUST call submit_portfolio_analysis — do not reply in plain text.

Macro-Aware Rules (apply based on current data):
• If VIX > 30: reduce all recommended position sizes by 50%, increase cash allocation recommendation
• If Fed is hawkish (recent communications): underweight growth/tech, overweight value/dividends (SCHD, VYM, BND)
• If major high-impact event < 3 days away: recommend holding cash until clarity — note the event
• If insider buying detected in any held ticker: increase position weight`,
      tools:       [ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_portfolio_analysis' },
      messages: [
        {
          role:    'user',
          content: `AutoPilot run initiated. Analyse portfolio and return top recommendations.\n\n${portfolioText}`,
        },
      ],
    });

    // ── 6. Parse Claude output ─────────────────────────────────────────────────
    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (!toolBlock) {
      throw new Error('Claude did not return a tool_use block');
    }

    const raw = toolBlock.input as {
      recommendations: Array<{
        ticker:     string;
        action:     'buy' | 'sell' | 'hold';
        qty:        number;
        confidence: number;
        reasoning:  string;
        risk_level: 'low' | 'medium' | 'high';
      }>;
      market_outlook: string;
      summary:        string;
    };

    // ── 7. Apply risk guard ────────────────────────────────────────────────────
    const recs: TradeRecommendation[] = raw.recommendations.map((r) => ({
      symbol:     r.ticker,
      action:     r.action,
      qty:        r.qty,
      confidence: r.confidence,
      reasoning:  r.reasoning,
      risk_level: r.risk_level,
    }));

    const currentPositionValues: Record<string, number> = {};
    for (const p of positions) {
      currentPositionValues[p.symbol] = parseFloat(p.market_value);
    }

    const latestPrices: Record<string, number> = {};
    for (const [ticker, info] of Object.entries(prices)) {
      latestPrices[ticker] = info.price;
    }

    const guardConfig: AutoInvestConfig = {
      mode:                 'auto',
      confidence_threshold: 65,
      max_trade_value:      Number(settings.max_trade_size),
      max_position_pct:     0.20,
      watchlist:            watchlistTickers,
    };

    const { approved, rejected } = applyRiskGuard(recs, guardConfig, {
      portfolioValue:        equity,
      availableCash:         buyingPower,
      currentPositionValues,
      latestPrices,
    });

    // ── 8. Execute approved buy/sell trades ────────────────────────────────────
    const tradeResults: TradeResult[] = [];
    const decisions: AutopilotDecision[] = [];

    for (const rec of approved) {
      if (rec.action === 'hold') {
        decisions.push({
          symbol:     rec.symbol,
          action:     'hold',
          qty:        0,
          confidence: rec.confidence,
          reasoning:  rec.reasoning,
          status:     'skipped',
        });
        continue;
      }

      try {
        const order = await placeMarketOrder(rec.symbol, rec.action as 'buy' | 'sell', rec.qty);

        // Record trade in trades table (best-effort)
        const price = latestPrices[rec.symbol] ?? null;
        const insert = await supabase.from('trades').insert({
          user_id:          user.id,
          ticker:           rec.symbol,
          side:             rec.action,
          qty:              rec.qty,
          price:            price || null,
          alpaca_order_id:  order.id,
          ai_reasoning:     rec.reasoning,
          confidence_score: rec.confidence,
          status:           'pending',
        });
        if (insert.error) {
          console.error('[autopilot/run] trade insert:', insert.error.message);
        }

        tradeResults.push({
          symbol:   rec.symbol,
          action:   rec.action as 'buy' | 'sell',
          qty:      rec.qty,
          status:   'executed',
          order_id: order.id,
        });

        decisions.push({
          symbol:     rec.symbol,
          action:     rec.action as 'buy' | 'sell',
          qty:        rec.qty,
          confidence: rec.confidence,
          reasoning:  rec.reasoning,
          status:     'executed',
          order_id:   order.id,
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Order failed';
        tradeResults.push({
          symbol: rec.symbol,
          action: rec.action as 'buy' | 'sell',
          qty:    rec.qty,
          status: 'failed',
          error:  errMsg,
        });

        decisions.push({
          symbol:     rec.symbol,
          action:     rec.action as 'buy' | 'sell',
          qty:        rec.qty,
          confidence: rec.confidence,
          reasoning:  rec.reasoning,
          status:     'rejected',
          error:      errMsg,
        });
      }
    }

    // Add rejected recommendations to decisions
    for (const rec of rejected) {
      decisions.push({
        symbol:     rec.symbol,
        action:     rec.action as 'buy' | 'sell' | 'hold',
        qty:        rec.qty,
        confidence: rec.confidence,
        reasoning:  rec.reasoning,
        status:     'rejected',
        error:      rec.rejection_reason,
      });
    }

    // ── 9. Compute totals ──────────────────────────────────────────────────────
    const executedCount = tradeResults.filter((t) => t.status === 'executed').length;
    const totalValue = tradeResults
      .filter((t) => t.status === 'executed')
      .reduce((sum, t) => sum + (latestPrices[t.symbol] ?? 0) * t.qty, 0);

    // ── 10. Log to autopilot_runs ──────────────────────────────────────────────
    const { data: runRow, error: runErr } = await supabase
      .from('autopilot_runs')
      .insert({
        user_id:         user.id,
        trades_executed: executedCount,
        total_value:     totalValue,
        market_outlook:  raw.market_outlook,
        summary:         raw.summary,
        decisions,
        status:          'completed',
      })
      .select()
      .single();

    if (runErr) {
      console.error('[autopilot/run] run insert:', runErr.message);
    }

    // ── 11. Update last_run_at and next_run_at ─────────────────────────────────
    const { error: updateErr } = await supabase
      .from('autopilot_settings')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: computeNextRunAt(settings.frequency ?? 'weekly'),
        updated_at:  new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateErr) {
      console.error('[autopilot/run] settings update:', updateErr.message);
    }

    return NextResponse.json({
      run:    runRow as AutopilotRun | null,
      trades: tradeResults,
      market_outlook: raw.market_outlook,
      summary:        raw.summary,
    });
  } catch (err: unknown) {
    console.error('[autopilot/run]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
