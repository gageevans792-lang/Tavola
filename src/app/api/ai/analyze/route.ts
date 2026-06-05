import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { getAccount, getPositions, getSnapshots } from '@/lib/alpaca/client';
import { anthropic } from '@/lib/anthropic/client';
import { applyRiskGuard } from '@/lib/ai/risk-guard';
import type {
  AlpacaPosition,
  AlpacaSnapshot,
  AutoInvestConfig,
  TradeRecommendation,
} from '@/types';

// ── Tool schema ───────────────────────────────────────────────────────────────

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
        description:
          'One entry per ticker you have a view on. Include holds explicitly so the user sees your full reasoning.',
        items: {
          type: 'object',
          required: ['ticker', 'action', 'qty', 'confidence', 'reasoning', 'risk_level'],
          properties: {
            ticker:     { type: 'string', description: 'Uppercase ticker symbol, e.g. AAPL' },
            action:     { type: 'string', enum: ['buy', 'sell', 'hold'] },
            qty:        { type: 'number', minimum: 0, description: 'Shares to buy/sell; 0 for hold' },
            confidence: { type: 'integer', minimum: 0, maximum: 100, description: 'Conviction 0–100. Only recommend buy/sell above 65.' },
            reasoning:  { type: 'string', description: '2–3 sentence rationale referencing actual data provided.' },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
      market_outlook: {
        type: 'string',
        description: 'Current macro/sector context relevant to this portfolio (2–3 sentences).',
      },
      summary: {
        type: 'string',
        description: 'Overall assessment and top priority action (3–4 sentences).',
      },
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function livePrice(snap: AlpacaSnapshot | undefined, fallback: string): number {
  return snap?.latestTrade?.p ?? snap?.minuteBar?.c ?? parseFloat(fallback);
}

function dailyChangePct(snap: AlpacaSnapshot | undefined, currentPrice: number): number {
  const prev = snap?.prevDailyBar?.c;
  if (!prev || prev === 0) return 0;
  return ((currentPrice - prev) / prev) * 100;
}

function buildPortfolioText(
  equity: number,
  buyingPower: number,
  cash: number,
  positions: AlpacaPosition[],
  snapshots: Record<string, AlpacaSnapshot>,
  watchlistTickers: string[],
): string {
  const posLines = positions.length
    ? positions.map((p) => {
        const price  = livePrice(snapshots[p.symbol], p.current_price);
        const chgPct = dailyChangePct(snapshots[p.symbol], price);
        const uPl    = parseFloat(p.unrealized_pl);
        const uPlPc  = parseFloat(p.unrealized_plpc) * 100;
        return (
          `  ${p.symbol.padEnd(6)} ` +
          `qty=${p.qty}  entry=$${parseFloat(p.avg_entry_price).toFixed(2)}  ` +
          `price=$${price.toFixed(2)}  ` +
          `mktval=$${parseFloat(p.market_value).toFixed(0)}  ` +
          `unrPL=${uPl >= 0 ? '+' : ''}$${uPl.toFixed(0)} (${uPlPc >= 0 ? '+' : ''}${uPlPc.toFixed(1)}%)  ` +
          `today=${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%`
        );
      }).join('\n')
    : '  (no open positions)';

  const watchOnly = watchlistTickers.filter(
    (t) => !positions.find((p) => p.symbol === t),
  );
  const watchLines = watchOnly.length
    ? watchOnly.map((t) => {
        const price = snapshots[t]?.latestTrade?.p ?? snapshots[t]?.minuteBar?.c ?? 0;
        return `  ${t.padEnd(6)} price=$${price > 0 ? price.toFixed(2) : 'N/A'}`;
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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST() {
  // ── 1. Authenticate ──────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ── 2. Fetch Alpaca positions (+ account for equity / buying power) ────────
    const [account, positions] = await Promise.all([
      getAccount(),
      getPositions(),
    ]);

    const equity       = parseFloat(account.equity);
    const buyingPower  = parseFloat(account.buying_power);
    const cash         = parseFloat(account.cash);

    // ── 3. Fetch user watchlist ────────────────────────────────────────────────
    let watchlistTickers: string[] = [];
    try {
      const { data, error } = await supabase
        .from('user_watchlist')
        .select('ticker')
        .eq('user_id', user.id);
      if (!error && data) {
        watchlistTickers = data.map((r: { ticker: string }) => r.ticker);
      }
    } catch {
      // table may not exist yet — continue with empty watchlist
    }

    // ── 4. Dedupe tickers and fetch snapshots ──────────────────────────────────
    const heldTickers = positions.map((p) => p.symbol);
    const allTickers  = [...new Set([...heldTickers, ...watchlistTickers])];
    const snapshots   = await getSnapshots(allTickers);

    // ── 5. Build portfolio snapshot text for Claude ────────────────────────────
    const portfolioText = buildPortfolioText(
      equity, buyingPower, cash, positions, snapshots, watchlistTickers,
    );

    // ── 6. Call Claude with forced tool use ────────────────────────────────────
    const response = await anthropic.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 2048,
      system: `You are a senior AI portfolio manager. Your job is to analyse the provided portfolio snapshot and produce specific, actionable trade recommendations.

Rules you must follow:
• Only recommend BUY for tickers on the watchlist or already held
• Only recommend SELL for tickers currently held
• Set qty=0 for hold actions
• Only recommend buy/sell when confidence ≥ 65
• Buy notional (qty × price) must not exceed $5,000 per trade
• A single position must not exceed 20% of total equity after the trade
• Do not recommend cumulative buys that exceed available buying power
• Provide 2–3 sentence reasoning that references the data you were given

You MUST call submit_portfolio_analysis — do not reply in plain text.`,
      tools:        [ANALYSIS_TOOL],
      tool_choice:  { type: 'tool', name: 'submit_portfolio_analysis' },
      messages: [
        {
          role:    'user',
          content: `Analyse my portfolio and return your recommendations.\n\n${portfolioText}`,
        },
      ],
    });

    // ── 7. Parse tool_use block ────────────────────────────────────────────────
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

    // ── 8. Map ticker → symbol and run risk guard ──────────────────────────────
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
    for (const [ticker, snap] of Object.entries(snapshots)) {
      latestPrices[ticker] = livePrice(snap, '0');
    }

    const guardConfig: AutoInvestConfig = {
      mode:                 'review',
      confidence_threshold: 65,
      max_trade_value:      5000,
      max_position_pct:     0.20,
      watchlist:            watchlistTickers,
    };

    const { approved, rejected } = applyRiskGuard(recs, guardConfig, {
      portfolioValue:        equity,
      availableCash:         buyingPower,
      currentPositionValues,
      latestPrices,
    });

    // ── 9. Write approved non-hold recommendations to ai_insights ─────────────
    const insightRows = approved
      .filter((r) => r.action !== 'hold')
      .map((r) => ({
        user_id:          user.id,
        type:             r.action as 'buy' | 'sell',
        ticker:           r.symbol,
        message:          r.reasoning,
        confidence_score: r.confidence,
        executed:         false,
      }));

    if (insightRows.length > 0) {
      await supabase.from('ai_insights').insert(insightRows);
    }

    // ── 10. Return result ──────────────────────────────────────────────────────
    const toOutput = (r: TradeRecommendation) => ({
      ticker:          r.symbol,
      action:          r.action,
      qty:             r.qty,
      confidence:      r.confidence,
      reasoning:       r.reasoning,
      risk_level:      r.risk_level,
      estimated_value: r.estimated_value,
    });

    return NextResponse.json({
      approved: approved.map(toOutput),
      blocked:  rejected.map((r) => ({
        ...toOutput(r),
        rejection_reason: r.rejection_reason,
      })),
      market_outlook: raw.market_outlook,
      summary:        raw.summary,
      portfolio: { equity, buying_power: buyingPower, cash },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[ai/analyze]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
