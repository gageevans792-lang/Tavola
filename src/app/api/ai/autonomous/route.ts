import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { getAccount, getPositions, getTickerPrices, placeMarketOrder } from '@/lib/alpaca/client';
import type { TickerPrice } from '@/lib/alpaca/client';
import { anthropic } from '@/lib/anthropic/client';
import { applyRiskGuard } from '@/lib/ai/risk-guard';
import { STRATEGIES, DEFAULT_STRATEGY_ID, getStrategy } from '@/lib/ai/strategies';
import type {
  AlpacaPosition,
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
            confidence: { type: 'integer', minimum: 0, maximum: 100, description: 'Conviction 0–100. Only recommend buy/sell above threshold.' },
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

function dailyChangePct(posCurrentPrice: number, avgEntry: number): number {
  if (avgEntry === 0) return 0;
  return ((posCurrentPrice - avgEntry) / avgEntry) * 100;
}

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
        const info      = prices[p.symbol];
        const price     = info?.price > 0 ? info.price : parseFloat(p.current_price);
        const src       = info?.price_source ?? 'position';
        const chgPct    = dailyChangePct(price, parseFloat(p.avg_entry_price));
        const uPl       = parseFloat(p.unrealized_pl);
        const uPlPc     = parseFloat(p.unrealized_plpc) * 100;
        const priceTag  = info?.price_unavailable ? 'N/A (estimated)' : `$${price.toFixed(2)} [${src}]`;
        return (
          `  ${p.symbol.padEnd(6)} ` +
          `qty=${p.qty}  entry=$${parseFloat(p.avg_entry_price).toFixed(2)}  ` +
          `price=${priceTag}  ` +
          `mktval=$${parseFloat(p.market_value).toFixed(0)}  ` +
          `unrPL=${uPl >= 0 ? '+' : ''}$${uPl.toFixed(0)} (${uPlPc >= 0 ? '+' : ''}${uPlPc.toFixed(1)}%)  ` +
          `chg=${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%`
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
        const src   = info?.price_source ?? 'unavailable';
        return `  ${t.padEnd(6)} price=${price > 0 ? `$${price.toFixed(2)} [${src}]` : 'N/A'}`;
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

export async function POST(req: NextRequest) {
  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { auto_execute?: boolean } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    // empty body is fine
  }

  try {
    // ── 2. Load user strategy ────────────────────────────────────────────────
    const { data: stratRow } = await supabase
      .from('user_strategies')
      .select('strategy_id, auto_execute, max_trade_value')
      .eq('user_id', user.id)
      .maybeSingle();

    const strategyId   = stratRow?.strategy_id ?? DEFAULT_STRATEGY_ID;
    const strategy     = getStrategy(strategyId);
    const validIds     = STRATEGIES.map((s) => s.id);
    const resolvedId   = validIds.includes(strategyId) ? strategyId : DEFAULT_STRATEGY_ID;
    const finalStrategy = resolvedId !== strategyId ? getStrategy(resolvedId) : strategy;

    // Resolve auto_execute: body override takes precedence
    const autoExecute: boolean =
      body.auto_execute !== undefined
        ? body.auto_execute
        : (stratRow?.auto_execute ?? false);

    // Resolve max_trade_value: user pref may override strategy default
    const userMaxTradeValue: number =
      stratRow?.max_trade_value != null
        ? Number(stratRow.max_trade_value)
        : finalStrategy.max_trade_value;

    // ── 3. Fetch account + positions in parallel ──────────────────────────────
    const [account, positions] = await Promise.all([
      getAccount(),
      getPositions(),
    ]);

    const equity      = parseFloat(account.equity);
    const buyingPower = parseFloat(account.buying_power);
    const cash        = parseFloat(account.cash);

    // ── 4. Fetch user watchlist ──────────────────────────────────────────────
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

    // ── 5. Fetch prices for all tickers ──────────────────────────────────────
    const heldTickers = positions.map((p) => p.symbol);
    const allTickers  = [...new Set([...heldTickers, ...watchlistTickers])];
    const prices      = await getTickerPrices(allTickers);

    // ── 6. Build portfolio text ───────────────────────────────────────────────
    const totalTickers     = allTickers.length;
    const unavailableCount = allTickers.filter((t) => prices[t]?.price_unavailable).length;
    const pricingLimited   = totalTickers > 0 && unavailableCount / totalTickers > 0.5;

    const pricingNote = pricingLimited
      ? '\n\nNote: live pricing is limited on this account tier. Use your knowledge of approximate current market prices to estimate position sizing, clearly noting you are estimating.'
      : '';

    const portfolioText = buildPortfolioText(
      equity, buyingPower, cash, positions, prices, watchlistTickers,
    );

    // ── 7. Call Claude with strategy-specific system prompt ───────────────────
    const baseRules = `
Rules you must follow:
• Only recommend BUY for tickers on the watchlist or already held
• Only recommend SELL for tickers currently held
• Set qty=0 for hold actions
• Only recommend buy/sell when confidence ≥ ${finalStrategy.confidence_threshold}
• Buy notional (qty × price) must not exceed $${finalStrategy.max_trade_value} per trade
• A single position must not exceed ${Math.round(finalStrategy.max_position_pct * 100)}% of total equity after the trade
• Do not recommend cumulative buys that exceed available buying power
• Provide 2–3 sentence reasoning that references the data you were given
• If a ticker shows price=N/A, note this in your reasoning and estimate conservatively${pricingNote}

You MUST call submit_portfolio_analysis — do not reply in plain text.`;

    const systemPrompt = `You are a senior AI portfolio manager operating under the "${finalStrategy.name}" strategy.

Strategy directive: ${finalStrategy.system_prompt}

${baseRules}`;

    const response = await anthropic.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 2048,
      system:     systemPrompt,
      tools:      [ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_portfolio_analysis' },
      messages: [
        {
          role:    'user',
          content: `Analyse my portfolio using the ${finalStrategy.name} strategy and return your recommendations.\n\n${portfolioText}`,
        },
      ],
    });

    // ── 8. Parse tool output ─────────────────────────────────────────────────
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

    // ── 9. Map and run risk guard ─────────────────────────────────────────────
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
      mode:                 autoExecute ? 'auto' : 'review',
      confidence_threshold: finalStrategy.confidence_threshold,
      max_trade_value:      userMaxTradeValue,
      max_position_pct:     finalStrategy.max_position_pct,
      watchlist:            watchlistTickers,
    };

    const { approved, rejected, warnings } = applyRiskGuard(recs, guardConfig, {
      portfolioValue:        equity,
      availableCash:         buyingPower,
      currentPositionValues,
      latestPrices,
    });

    // ── 10. Auto-execute if enabled ───────────────────────────────────────────
    const executed: Array<{ symbol: string; action: string; qty: number; order_id: string; status: string }> = [];

    if (autoExecute) {
      for (const rec of approved) {
        if (rec.action === 'hold') continue;
        try {
          const order = await placeMarketOrder(
            rec.symbol,
            rec.action as 'buy' | 'sell',
            rec.qty,
          );
          executed.push({
            symbol:   rec.symbol,
            action:   rec.action,
            qty:      rec.qty,
            order_id: order.id,
            status:   order.status,
          });
        } catch {
          warnings.push(`Failed to execute ${rec.action} order for ${rec.symbol}`);
        }
      }
    }

    // ── 11. Write approved non-hold recs to ai_insights ──────────────────────
    const insightRows = approved
      .filter((r) => r.action !== 'hold')
      .map((r) => ({
        user_id:          user.id,
        type:             r.action as 'buy' | 'sell',
        ticker:           r.symbol,
        message:          r.reasoning,
        confidence_score: r.confidence,
        qty:              r.qty,
        executed:         autoExecute,
      }));

    if (insightRows.length > 0) {
      await supabase.from('ai_insights').insert(insightRows);
    }

    // ── 12. Insert autonomous_sessions row ────────────────────────────────────
    const tradesApproved    = approved.filter((r) => r.action !== 'hold').length;
    const tradesExecuted    = executed.length;
    const totalTradeValue   = approved
      .filter((r) => r.action !== 'hold')
      .reduce((sum, r) => sum + (r.estimated_value ?? 0), 0);

    const { data: sessionRow } = await supabase
      .from('autonomous_sessions')
      .insert({
        user_id:           user.id,
        strategy_id:       finalStrategy.id,
        strategy_name:     finalStrategy.name,
        status:            'completed',
        auto_executed:     autoExecute,
        trades_approved:   tradesApproved,
        trades_executed:   tradesExecuted,
        total_trade_value: totalTradeValue,
        market_outlook:    raw.market_outlook,
        summary:           raw.summary,
        warnings:          warnings,
      })
      .select()
      .single();

    // ── 13. Return result ─────────────────────────────────────────────────────
    const toOutput = (r: TradeRecommendation) => ({
      symbol:          r.symbol,
      action:          r.action,
      qty:             r.qty,
      confidence:      r.confidence,
      reasoning:       r.reasoning,
      risk_level:      r.risk_level,
      estimated_value: r.estimated_value,
    });

    return NextResponse.json({
      session: sessionRow
        ? {
            id:                sessionRow.id,
            strategy_name:     sessionRow.strategy_name,
            trades_approved:   sessionRow.trades_approved,
            trades_executed:   sessionRow.trades_executed,
            total_trade_value: sessionRow.total_trade_value,
            market_outlook:    sessionRow.market_outlook,
            summary:           sessionRow.summary,
            warnings:          sessionRow.warnings,
            created_at:        sessionRow.created_at,
          }
        : {
            id:                null,
            strategy_name:     finalStrategy.name,
            trades_approved:   tradesApproved,
            trades_executed:   tradesExecuted,
            total_trade_value: totalTradeValue,
            market_outlook:    raw.market_outlook,
            summary:           raw.summary,
            warnings,
            created_at:        new Date().toISOString(),
          },
      approved:  approved.map(toOutput),
      rejected:  rejected.map((r) => ({
        ...toOutput(r),
        rejection_reason: r.rejection_reason,
      })),
      executed,
      warnings,
      portfolio: { value: equity, cash },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message || 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
