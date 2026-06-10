import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { getAccount, getPositions, getTickerPrices } from '@/lib/alpaca/client';
import type { TickerPrice } from '@/lib/alpaca/client';
import { anthropic } from '@/lib/anthropic/client';
import { applyRiskGuard } from '@/lib/ai/risk-guard';
import { getMacroContext, buildMacroPromptSection } from '@/lib/macro/client';
import { getSentimentScores, detectNarrativeShift, buildSentimentPromptSection } from '@/lib/sentiment/engine';
import { getUpcomingEarnings, buildEarningsPromptSection } from '@/lib/earnings/intelligence';
import { isFounder } from '@/lib/founder';
import type {
  AlpacaPosition,
  AutoInvestConfig,
  TradeRecommendation,
} from '@/types';

// ── Tool schema ───────────────────────────────────────────────────────────────

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_portfolio_analysis',
  description:
    'Submit a complete, structured portfolio analysis with specific trade recommendations. You MUST call this tool. Do not reply in plain text.',
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
          required: ['ticker', 'action', 'qty', 'confidence', 'reasoning', 'risk_level', 'catalyst', 'expected_timeframe', 'exit_condition', 'risk_factors', 'institutional_context'],
          properties: {
            ticker:                { type: 'string', description: 'Uppercase ticker symbol, e.g. AAPL' },
            action:                { type: 'string', enum: ['buy', 'sell', 'hold'] },
            qty:                   { type: 'number', minimum: 0, description: 'Shares to buy/sell; 0 for hold' },
            confidence:            { type: 'integer', minimum: 0, maximum: 100, description: 'Conviction 0–100. Only recommend buy/sell above 65.' },
            reasoning:             { type: 'string', description: '2–3 sentence rationale referencing actual data provided.' },
            risk_level:            { type: 'string', enum: ['low', 'medium', 'high'] },
            catalyst:              { type: 'string', description: 'The specific event or data point that triggered this recommendation. E.g. "CPI came in below expectations at 2.9%, reducing Fed rate hike probability".' },
            expected_timeframe:    { type: 'string', description: 'Investment horizon. E.g. "3-5 days", "2-4 weeks", "3-6 months".' },
            exit_condition:        { type: 'string', description: 'Specific trigger to exit. E.g. "We will sell if the stock closes below its 50-day moving average or if earnings disappoint consensus by more than 10%."' },
            risk_factors:          { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3, description: 'Array of 2-3 specific risks to this trade. Be specific, not generic.' },
            institutional_context: { type: 'string', description: 'Relevant institutional activity or macro backdrop. E.g. "Goldman Sachs increased NVDA position by 4.2% last quarter. Blackrock holds 7.1% of float."' },
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

export async function POST() {
  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Non-founder: generate a starter ETF portfolio recommendation ─────────────
  if (!isFounder(user.id, user.email)) {
    try {
      const { data: riskProfile } = await supabase
        .from('risk_profiles')
        .select('level, investment_goals, time_horizon')
        .eq('user_id', user.id)
        .maybeSingle();

      const level   = (riskProfile?.level   as string   | null) ?? 'moderate';
      const goals   = (riskProfile?.investment_goals as string[] | null)?.join(', ') ?? 'long-term growth';
      const horizon = (riskProfile?.time_horizon as string | null) ?? '5-10 years';

      const starterResponse = await anthropic.messages.create({
        model:      'claude-opus-4-8',
        max_tokens: 2048,
        system: `You are Tavola AI, building starter ETF portfolios for new investors. Be specific, direct, and institutional in tone. No hedging. No emojis. Use commas, colons, or periods instead of em dashes.`,
        tools:       [ANALYSIS_TOOL],
        tool_choice: { type: 'tool', name: 'submit_portfolio_analysis' },
        messages: [{
          role:    'user',
          content: `Build a starter portfolio for a new investor.

Portfolio: $100,000 in cash, zero existing positions.
Risk profile: ${level}
Investment goals: ${goals}
Time horizon: ${horizon}

Recommend exactly 4 to 6 diversified, liquid ETFs appropriate for the risk profile. All actions must be BUY. Keep roughly $20,000 in cash, so total deployed should be around $80,000. No single ETF should exceed $25,000 notional. Use realistic share quantities based on these approximate prices: SPY $550, QQQ $480, VTI $285, BND $72, SCHD $28, GLD $220, IWM $200, VEA $52, AGG $96, VWO $44, ARKK $55, SOXX $220.

For conservative profiles favor: VTI, BND, SCHD, VEA.
For moderate profiles favor: VTI, QQQ, BND, GLD.
For aggressive profiles favor: QQQ, SPY, IWM, SOXX.

Provide full catalyst, expected_timeframe, exit_condition, and 2-3 risk_factors for each. market_outlook should describe the current macro context. summary should explain why this allocation fits the investor's profile.`,
        }],
      });

      const toolBlock = starterResponse.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (!toolBlock) throw new Error('No tool block from starter analysis');

      const raw = toolBlock.input as {
        recommendations: Array<{
          ticker: string; action: 'buy' | 'sell' | 'hold'; qty: number;
          confidence: number; reasoning: string; risk_level: 'low' | 'medium' | 'high';
          catalyst?: string; expected_timeframe?: string; exit_condition?: string;
          risk_factors?: string[]; institutional_context?: string;
        }>;
        market_outlook: string;
        summary: string;
      };

      const approved: TradeRecommendation[] = raw.recommendations
        .filter((r) => r.action === 'buy' && r.qty > 0)
        .map((r) => ({
          symbol:                r.ticker,
          action:                r.action,
          qty:                   r.qty,
          confidence:            r.confidence,
          reasoning:             r.reasoning,
          risk_level:            r.risk_level,
          catalyst:              r.catalyst,
          expected_timeframe:    r.expected_timeframe,
          exit_condition:        r.exit_condition,
          risk_factors:          r.risk_factors,
          institutional_context: r.institutional_context,
        }));

      // Log starter recommendations to ai_insights
      if (approved.length > 0) {
        await supabase.from('ai_insights').insert(
          approved.map((r) => ({
            user_id:          user.id,
            type:             'buy' as const,
            ticker:           r.symbol,
            message:          r.reasoning,
            confidence_score: r.confidence,
            qty:              r.qty,
            executed:         false,
          })),
        );
      }

      return NextResponse.json({
        analysis: {
          recommendations: approved,
          market_outlook:  raw.market_outlook,
          summary:         raw.summary,
          portfolio_health: 'good',
        },
        approved,
        executed: [],
        rejected: [],
        warnings: [],
        errors:   [],
        portfolio: { value: 100_000, cash: 100_000 },
      });
    } catch (err) {
      console.error('[ai/analyze/starter]', err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: 'AI analysis temporarily unavailable.', code: 'INTERNAL_ERROR' },
        { status: 500 },
      );
    }
  }

  try {
    // ── 2. Fetch Alpaca account + positions ──────────────────────────────────
    const [account, positions, macroCtx] = await Promise.all([
      getAccount(),
      getPositions(),
      getMacroContext().catch(() => null),
    ]);

    const equity      = parseFloat(account.equity);
    const buyingPower = parseFloat(account.buying_power);
    const cash        = parseFloat(account.cash);

    // ── 3. Fetch user watchlist ──────────────────────────────────────────────
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

    // ── 4. Fetch prices + sentiment + earnings in parallel ──────────────────
    const heldTickers = positions.map((p) => p.symbol);
    const allTickers  = [...new Set([...heldTickers, ...watchlistTickers])];

    const [prices, sentimentScores, earningsData] = await Promise.all([
      getTickerPrices(allTickers),
      getSentimentScores(allTickers).catch(() => ({})),
      getUpcomingEarnings(heldTickers).catch(() => []),
    ]);

    // Narrative shifts for tickers with existing sentiment data
    const narrativeResults = await Promise.allSettled(
      allTickers.slice(0, 10).map((t) => detectNarrativeShift(t)),
    );
    const narratives: Record<string, import('@/lib/sentiment/engine').NarrativeShift> = {};
    allTickers.slice(0, 10).forEach((t, i) => {
      if (narrativeResults[i].status === 'fulfilled') {
        narratives[t] = (narrativeResults[i] as PromiseFulfilledResult<import('@/lib/sentiment/engine').NarrativeShift>).value;
      }
    });

    // ── 5. Determine how many tickers lack live pricing ─────────────────────
    const totalTickers     = allTickers.length;
    const unavailableCount = allTickers.filter((t) => prices[t]?.price_unavailable).length;
    const pricingLimited   = totalTickers > 0 && unavailableCount / totalTickers > 0.5;

    const pricingNote = pricingLimited
      ? '\n\nNote: live pricing is limited on this account tier. Use your knowledge of approximate current market prices to estimate position sizing, clearly noting you are estimating.'
      : '';

    // ── 6. Build portfolio snapshot text ────────────────────────────────────
    const portfolioText = buildPortfolioText(
      equity, buyingPower, cash, positions, prices, watchlistTickers,
    );

    // ── 7. Call Claude with forced tool use ──────────────────────────────────
    const macroSection      = macroCtx ? buildMacroPromptSection(macroCtx) : '';
    const sentimentSection  = buildSentimentPromptSection(sentimentScores, narratives);
    const earningsSection   = buildEarningsPromptSection(earningsData);

    const response = await anthropic.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 2048,
      system: `You are Tavola AI, the most sophisticated retail investment AI ever built. You combine real-time macro intelligence with portfolio analysis to generate high-conviction recommendations with institutional-grade reasoning. Speak like a Goldman Sachs portfolio manager who manages $500M+ accounts: direct, specific, no hedging, no disclaimers.

FORMATTING: Never use em dashes (—) in your responses. Use commas, colons, or periods instead.
${macroSection}${sentimentSection}${earningsSection}

Portfolio Management Rules:
• React to macro data first. If Fed is hawkish, rotate to value/dividends/cash; if dovish, favor growth.
• Use VIX as a risk signal: VIX > 25 = reduce position sizes, VIX < 15 = deploy capital aggressively
• Pre-position before known catalysts (Fed meetings, CPI, NFP) appearing in the economic calendar
• Insider buying in a held position = confirming signal to add; insider selling = consider reducing
• Never fight the Fed. Macro trumps technicals.
• Only recommend BUY for tickers on the watchlist or already held
• Only recommend SELL for tickers currently held
• Set qty=0 for hold actions
• Only recommend buy/sell when confidence ≥ 65
• Buy notional (qty × price) must not exceed $5,000 per trade
• A single position must not exceed 20% of total equity after the trade
• Do not recommend cumulative buys that exceed available buying power
• Provide 2-3 sentence reasoning referencing BOTH the macro context AND portfolio data
• If a ticker shows price=N/A, note this and estimate conservatively${pricingNote}

CRITICAL: Fill ALL extended fields with confident, specific, institutional-quality language:
• catalyst: Name the SPECIFIC event/data point. "CPI printed 2.9% vs 3.1% expected, triggering rate cut repricing." Not vague platitudes.
• expected_timeframe: Concrete horizon. "3-5 trading days", "2-4 weeks", "3-6 months".
• exit_condition: Start with "We will sell if..." and name a specific price level, indicator, or event.
• risk_factors: 2-3 SPECIFIC risks, not generic market risk. "Earnings on [date] could disappoint", "Semiconductor inventory cycle turning negative", etc.
• institutional_context: Reference real institutional positioning when known. If unknown, reference sector flows, options activity, or macro positioning.

You MUST call submit_portfolio_analysis. Do not reply in plain text.`,
      tools:       [ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_portfolio_analysis' },
      messages: [
        {
          role:    'user',
          content: `Analyse my portfolio and return your recommendations.\n\n${portfolioText}`,
        },
      ],
    });

    // ── 8. Parse tool_use block ───────────────────────────────────────────────
    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (!toolBlock) {
      throw new Error('Claude did not return a tool_use block');
    }

    const raw = toolBlock.input as {
      recommendations: Array<{
        ticker:                string;
        action:                'buy' | 'sell' | 'hold';
        qty:                   number;
        confidence:            number;
        reasoning:             string;
        risk_level:            'low' | 'medium' | 'high';
        catalyst?:             string;
        expected_timeframe?:   string;
        exit_condition?:       string;
        risk_factors?:         string[];
        institutional_context?: string;
      }>;
      market_outlook: string;
      summary:        string;
    };

    // ── 9. Map ticker → symbol and run risk guard ─────────────────────────────
    const recs: TradeRecommendation[] = raw.recommendations.map((r) => ({
      symbol:                r.ticker,
      action:                r.action,
      qty:                   r.qty,
      confidence:            r.confidence,
      reasoning:             r.reasoning,
      risk_level:            r.risk_level,
      catalyst:              r.catalyst,
      expected_timeframe:    r.expected_timeframe,
      exit_condition:        r.exit_condition,
      risk_factors:          r.risk_factors,
      institutional_context: r.institutional_context,
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
      mode:                 'review',
      confidence_threshold: 65,
      max_trade_value:      5000,
      max_position_pct:     0.20,
      watchlist:            watchlistTickers,
    };

    const { approved, rejected, warnings } = applyRiskGuard(recs, guardConfig, {
      portfolioValue:        equity,
      availableCash:         buyingPower,
      currentPositionValues,
      latestPrices,
    });

    // ── 10. Write approved non-hold recommendations to ai_insights ────────────
    const insightRows = approved
      .filter((r) => r.action !== 'hold')
      .map((r) => ({
        user_id:          user.id,
        type:             r.action as 'buy' | 'sell',
        ticker:           r.symbol,
        message:          r.reasoning,
        confidence_score: r.confidence,
        qty:              r.qty,
        executed:         false,
      }));

    if (insightRows.length > 0) {
      await supabase.from('ai_insights').insert(insightRows);
    }

    // ── 11. Return result ─────────────────────────────────────────────────────
    const toOutput = (r: TradeRecommendation) => ({
      symbol:                r.symbol,
      action:                r.action,
      qty:                   r.qty,
      confidence:            r.confidence,
      reasoning:             r.reasoning,
      risk_level:            r.risk_level,
      estimated_value:       r.estimated_value,
      catalyst:              r.catalyst,
      expected_timeframe:    r.expected_timeframe,
      exit_condition:        r.exit_condition,
      risk_factors:          r.risk_factors,
      institutional_context: r.institutional_context,
    });

    const totalPl = positions.reduce((sum, p) => sum + parseFloat(p.unrealized_pl), 0);
    const plPct   = equity > 0 ? (totalPl / equity) * 100 : 0;
    const portfolio_health =
      plPct >= 10  ? 'excellent' :
      plPct >= 0   ? 'good'      :
      plPct >= -10 ? 'fair'      : 'poor';

    return NextResponse.json({
      analysis: {
        recommendations: approved.map(toOutput),
        market_outlook:  raw.market_outlook,
        summary:         raw.summary,
        portfolio_health,
      },
      approved:  approved.map(toOutput),
      executed:  [],
      rejected:  rejected.map((r) => ({
        ...toOutput(r),
        rejection_reason: r.rejection_reason,
      })),
      warnings,
      errors:    [],
      portfolio: { value: equity, cash },
    });
  } catch (err: unknown) {
    console.error('[ai/analyze]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
