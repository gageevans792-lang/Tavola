import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  getAccount,
  getPositions,
  getTickerPrices,
  getDailyBars,
} from '@/lib/alpaca/client';
import type { TickerPrice, DailyBar } from '@/lib/alpaca/client';
import { anthropic } from '@/lib/anthropic/client';
import { applyRiskGuard } from '@/lib/ai/risk-guard';
import { getMacroContext, buildMacroPromptSection } from '@/lib/macro/client';
import { isFounder } from '@/lib/founder';
import type { AlpacaPosition, AutoInvestConfig, TradeRecommendation, TradeSide } from '@/types';
import type { SyncedHolding } from '@/lib/alpaca/sync';
import type { AutopilotDecision, AutopilotRun } from '../history/route';
import { getSentimentScores, buildSentimentPromptSection } from '@/lib/sentiment/engine';
import { getUpcomingEarnings, buildEarningsPromptSection } from '@/lib/earnings/intelligence';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecommendationResult {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  qty:    number;
  status: string;
}

interface SectorMoment {
  ticker: string;
  name:   string;
  ret5d:  number;
  ret30d: number;
}

// ── Full ETF universe (UPGRADE 1) ─────────────────────────────────────────────

const FULL_UNIVERSE: Record<string, string> = {
  // US Equities — broad market
  'SPY':  'S&P 500 broad market',
  'VTI':  'Total US market',
  'QQQ':  'NASDAQ tech heavy',
  'IWM':  'Small cap Russell 2000',
  'VTV':  'Value stocks',
  'VUG':  'Growth stocks',
  // Sectors
  'XLK':  'Technology',
  'XLF':  'Financials',
  'XLE':  'Energy',
  'XLV':  'Healthcare',
  'XLI':  'Industrials',
  'XLY':  'Consumer discretionary',
  'XLP':  'Consumer staples',
  'XLU':  'Utilities',
  'XLRE': 'Real estate',
  // International
  'VEA':  'Developed markets',
  'VWO':  'Emerging markets',
  'EWJ':  'Japan',
  // Fixed Income
  'BND':  'Total bond market',
  'TLT':  'Long treasury bonds',
  'SHY':  'Short treasury bonds',
  'HYG':  'High yield bonds',
  'TIP':  'Inflation protected',
  // Alternatives
  'GLD':  'Gold',
  'SLV':  'Silver',
  'VNQ':  'Real estate REITs',
  'DJP':  'Commodities',
  // Defensive / smart-beta
  'USMV': 'Low volatility US',
  'SPLV': 'S&P 500 low volatility',
  'SCHD': 'Dividend growth',
};

const SECTOR_NAMES: Record<string, string> = {
  'XLK':  'Technology',
  'XLF':  'Financials',
  'XLE':  'Energy',
  'XLV':  'Healthcare',
  'XLI':  'Industrials',
  'XLY':  'Consumer Discret.',
  'XLP':  'Consumer Staples',
  'XLU':  'Utilities',
  'XLRE': 'Real Estate',
};

// Tech-correlated tickers — used for concentration check
const TECH_CORRELATED = new Set([
  'QQQ', 'XLK', 'VUG', 'VGT', 'ARKK',
  'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOG', 'GOOGL', 'META', 'TSLA', 'AMD',
]);

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

// ── Sector momentum (UPGRADE 2 + 4) ──────────────────────────────────────────

async function fetchSectorMomentum(): Promise<{
  sectors:   SectorMoment[];
  spyRet30d: number;
  shyRet30d: number;
  vixyPrice: number;
}> {
  const FETCH_TICKERS = ['SPY', 'SHY', 'VIXY', ...Object.keys(SECTOR_NAMES)];

  // Fetch historical bars for all tickers in parallel
  const settled = await Promise.allSettled(
    FETCH_TICKERS.map((t) => getDailyBars(t, 35)),
  );

  const barsMap: Record<string, DailyBar[]> = {};
  FETCH_TICKERS.forEach((ticker, i) => {
    const r = settled[i];
    barsMap[ticker] = r.status === 'fulfilled' ? r.value : [];
  });

  function calcReturn(bars: DailyBar[], lookback: number): number {
    if (bars.length < 2) return 0;
    const recentIdx = bars.length - 1;
    const pastIdx   = Math.max(0, recentIdx - lookback);
    const recent    = bars[recentIdx].close;
    const past      = bars[pastIdx].close;
    return past > 0 ? ((recent - past) / past) * 100 : 0;
  }

  const sectors: SectorMoment[] = Object.keys(SECTOR_NAMES).map((ticker) => ({
    ticker,
    name:  SECTOR_NAMES[ticker],
    ret5d:  calcReturn(barsMap[ticker] ?? [], 5),
    ret30d: calcReturn(barsMap[ticker] ?? [], 30),
  }));
  sectors.sort((a, b) => b.ret30d - a.ret30d);

  const vixyBars  = barsMap['VIXY'] ?? [];
  const vixyPrice = vixyBars.length > 0 ? vixyBars[vixyBars.length - 1].close : 0;

  return {
    sectors,
    spyRet30d: calcReturn(barsMap['SPY'] ?? [], 30),
    shyRet30d: calcReturn(barsMap['SHY'] ?? [], 30),
    vixyPrice,
  };
}

// ── Market regime (UPGRADE 2) ─────────────────────────────────────────────────

function getMarketRegime(spyRet30d: number, shyRet30d: number): string {
  if (spyRet30d > shyRet30d + 3) return 'RISK-ON: equities strongly outperforming bonds; deploy into growth/momentum';
  if (shyRet30d > spyRet30d + 1) return 'RISK-OFF: bonds outperforming stocks; rotate defensive (GLD, BND, XLP, XLU)';
  if (spyRet30d < -5)             return 'BEARISH: S&P 500 down >5% last 30 days; reduce equity, increase GLD/BND hedge';
  return 'NEUTRAL: mixed signals; balanced approach, maintain diversification';
}

// ── VIX interpretation (UPGRADE 2) ───────────────────────────────────────────

function getVixLabel(vix: number): string {
  if (vix <= 0)  return 'unavailable. Proceed with moderate risk.';
  if (vix < 15)  return `${vix.toFixed(1)} (Extreme Greed): risk-on; lean into QQQ, XLK, VUG, IWM`;
  if (vix < 20)  return `${vix.toFixed(1)} (Greed): risk-on; maintain growth positions`;
  if (vix < 25)  return `${vix.toFixed(1)} (Neutral): balanced; avoid over-concentration`;
  if (vix < 35)  return `${vix.toFixed(1)} (Fear): rotate 20% defensive: XLP, XLU, BND, GLD, SCHD`;
  return         `${vix.toFixed(1)} (Extreme Fear): defensive mode; 40%+ bonds/gold, minimize new equity buys`;
}

// ── Rebalancing alerts (UPGRADE 3) ───────────────────────────────────────────

function detectRebalancingNeeds(
  positions: AlpacaPosition[],
  equity:    number,
  cash:      number,
): string[] {
  const alerts: string[] = [];
  let techExposure = 0;

  for (const pos of positions) {
    const mv  = parseFloat(pos.market_value);
    const pct = equity > 0 ? (mv / equity) * 100 : 0;

    if (pct > 25) {
      const trimAmt = ((pct - 20) / 100 * equity).toFixed(0);
      alerts.push(
        `OVERWEIGHT: ${pos.symbol} is ${pct.toFixed(1)}% of portfolio (limit 20%). ` +
        `TRIM ~$${trimAmt} to reach 20% target`,
      );
    }
    if (TECH_CORRELATED.has(pos.symbol)) techExposure += pct;
  }

  if (techExposure > 50) {
    alerts.push(
      `TECH OVERCONCENTRATION: ${techExposure.toFixed(1)}% in tech-correlated assets ` +
      `(QQQ/XLK/VUG/individual tech stocks). ROTATE ~15% into XLV, XLF, SCHD, or BND`,
    );
  }

  const cashPct = equity > 0 ? (cash / equity) * 100 : 0;
  if (cashPct > 40) {
    alerts.push(
      `IDLE CASH: ${cashPct.toFixed(1)}% uninvested ($${cash.toFixed(0)}). ` +
      `DEPLOY into core ETFs: VTI (40%), SCHD (30%), GLD (20%), BND (10%)`,
    );
  }

  return alerts;
}

// ── Portfolio text builder ────────────────────────────────────────────────────

function buildPortfolioText(
  equity:           number,
  buyingPower:      number,
  cash:             number,
  positions:        AlpacaPosition[],
  prices:           Record<string, TickerPrice>,
  universeKeys:     string[],
): string {
  const posLines = positions.length
    ? positions.map((p) => {
        const info  = prices[p.symbol];
        const price = info?.price > 0 ? info.price : parseFloat(p.current_price);
        const mv    = parseFloat(p.market_value);
        const pct   = equity > 0 ? (mv / equity * 100).toFixed(1) : '?';
        const uPl   = parseFloat(p.unrealized_pl);
        const uPlPc = parseFloat(p.unrealized_plpc) * 100;
        return (
          `  ${p.symbol.padEnd(6)} ` +
          `qty=${p.qty}  wt=${pct}%  entry=$${parseFloat(p.avg_entry_price).toFixed(2)}  ` +
          `price=$${price.toFixed(2)}  mktval=$${mv.toFixed(0)}  ` +
          `unrPL=${uPl >= 0 ? '+' : ''}$${uPl.toFixed(0)} (${uPlPc >= 0 ? '+' : ''}${uPlPc.toFixed(1)}%)`
        );
      }).join('\n')
    : '  (no open positions: deploy all available buying power)';

  const heldSymbols  = new Set(positions.map((p) => p.symbol));
  const candidateKeys = universeKeys.filter((t) => !heldSymbols.has(t));
  const candidateLines = candidateKeys.map((t) => {
    const info = prices[t];
    return `  ${t.padEnd(6)} $${info?.price > 0 ? info.price.toFixed(2) : 'N/A'}  ${FULL_UNIVERSE[t] ?? ''}`;
  }).join('\n');

  return `ACCOUNT SNAPSHOT
================
Equity:        $${equity.toFixed(2)}
Buying power:  $${buyingPower.toFixed(2)}
Cash:          $${cash.toFixed(2)}
Invested:      $${(equity - cash).toFixed(2)}

CURRENT POSITIONS (with portfolio weight)
==========================================
${posLines}

CANDIDATE BUY UNIVERSE (not currently held)
=============================================
${candidateLines || '  (all universe positions already held)'}`;
}

// ── System prompt (UPGRADE 2 — macro-aware) ───────────────────────────────────

function buildSystemPrompt(opts: {
  vixLabel:        string;
  marketRegime:    string;
  topSectors:      SectorMoment[];
  bottomSectors:   SectorMoment[];
  rebalAlerts:     string[];
  macroSection:    string;
  maxTradeSize:    number;
  equity:          number;
  buyingPower:     number;
}): string {
  const { vixLabel, marketRegime, topSectors, bottomSectors, rebalAlerts, macroSection, maxTradeSize, equity } = opts;

  const topStr = topSectors.length
    ? topSectors.slice(0, 3).map((s, i) =>
        `  ${i + 1}. ${s.ticker} ${s.name}: 30d=${s.ret30d >= 0 ? '+' : ''}${s.ret30d.toFixed(1)}%  5d=${s.ret5d >= 0 ? '+' : ''}${s.ret5d.toFixed(1)}%`,
      ).join('\n')
    : '  (data unavailable: use macro judgment)';

  const botStr = bottomSectors.length
    ? bottomSectors.slice(-3).reverse().map((s, i) =>
        `  ${i + 1}. ${s.ticker} ${s.name}: 30d=${s.ret30d >= 0 ? '+' : ''}${s.ret30d.toFixed(1)}%  5d=${s.ret5d >= 0 ? '+' : ''}${s.ret5d.toFixed(1)}%`,
      ).join('\n')
    : '  (data unavailable)';

  const rebalStr = rebalAlerts.length
    ? rebalAlerts.map((a) => `  ⚠ ${a}`).join('\n')
    : '  (no critical rebalancing alerts)';

  const maxPosPct = 20;
  const maxPosVal = (maxPosPct / 100 * equity).toFixed(0);

  return `${macroSection}

FORMATTING: Never use em dashes (—) in your responses. Use commas, colons, or periods instead.

You are Tavola's Chief Portfolio Manager, an AI investment engine responsible for building and managing a well-diversified, risk-adjusted ETF portfolio.

TODAY'S MACRO CONTEXT
=====================
VIX / Fear-Greed: ${vixLabel}
Market Regime:    ${marketRegime}

Best performing sectors (30-day momentum):
${topStr}

Worst performing / rotate away from:
${botStr}

REBALANCING ALERTS (address these first):
${rebalStr}

INVESTMENT MANDATE
==================
1. DIVERSIFICATION IS PARAMOUNT: never put more than 20% in any single position ($${maxPosVal} cap at current equity)
2. VIX < 15 (Extreme Greed) → lean into growth: QQQ, XLK, VUG, IWM, sector momentum leaders
3. VIX 15-20 (Greed) → maintain growth positions, selective sector ETF buys
4. VIX 20-25 (Neutral) → balanced; add SCHD, VTV, XLF for stability
5. VIX > 25 (Fear) → rotate defensive: XLP, XLU, BND, GLD, SCHD, TIP. 20-40% defensive.
6. VIX > 35 (Extreme Fear) → defensive mode: 40%+ GLD/BND, avoid new equity, trim losers
7. NEVER hold more than 60% in tech-correlated assets (QQQ + XLK + VUG + individual tech combined)
8. If tech (XLK) down >3% in past week → reduce tech, add XLF/XLE/XLV/XLI
9. Gold (GLD) and bonds (BND, TLT) are hedges. Maintain 10-20% when uncertainty is elevated.
10. Dividend/value stocks (SCHD, VTV, XLF) provide stability when growth sells off
11. The Dow outperforming NASDAQ → rotate from growth to value/industrials (XLI, XLF, VTV)
12. Rotate FROM sectors in the bottom-3 momentum list INTO the top-3 momentum sectors
13. Always explain rotation decisions in plain English so users understand WHY
14. CRYPTO ALLOCATION: You also have access to cryptocurrency via Alpaca. Consider adding BTC/USD or ETH/USD as a small satellite position (max 5% of portfolio) when crypto momentum is strong and risk appetite is high (VIX < 20). Crypto adds diversification uncorrelated to equities.

TARGET PORTFOLIO STRUCTURE (core-satellite):
  Core (50-60%):    VTI, SPY, or SCHD: broad market + dividends (stability foundation)
  Satellite (30%):  Top-momentum sector ETFs + growth (capture alpha)
  Hedge (10-20%):   GLD, BND, or TIP: downside protection

EXECUTION RULES
===============
• Only recommend BUY for tickers in the candidate universe provided
• Only recommend SELL for tickers currently held; sell if >25% weight OR significantly underperforming vs sector
• Set qty=0 for hold recommendations
• Only execute trades with confidence ≥ 65
• Buy notional (qty × price) must not exceed $${maxTradeSize} per trade
• A single position must not exceed ${maxPosPct}% of total equity after the trade
• Recommend 4-6 trades per run to actively optimize the portfolio
• If buying power is available, ALWAYS deploy at least some capital. Idle cash is a cost.
• Do not recommend cumulative buys exceeding available buying power
• Provide 2-3 sentence reasoning per recommendation referencing specific macro data above
• You MUST call submit_portfolio_analysis. Do not reply in plain text.`;
}

// ── Simulated account helpers ─────────────────────────────────────────────────

function holdingToPosition(h: SyncedHolding): AlpacaPosition {
  const upl    = h.unrealized_pl ?? 0;
  const uplpc  = (h.unrealized_plpc ?? 0) / 100; // stored as %, Alpaca uses decimal
  return {
    asset_id:                 h.ticker,
    symbol:                   h.ticker,
    exchange:                 'SIMULATED',
    asset_class:              'us_equity',
    qty:                      String(h.qty),
    qty_available:            String(h.qty),
    avg_entry_price:          String(h.avg_entry_price),
    side:                     'buy' as TradeSide,
    market_value:             String(h.market_value),
    cost_basis:               String(h.qty * h.avg_entry_price),
    unrealized_pl:            String(upl),
    unrealized_plpc:          String(uplpc),
    unrealized_intraday_pl:   '0',
    unrealized_intraday_plpc: '0',
    current_price:            String(h.current_price),
    lastday_price:            String(h.current_price),
    change_today:             '0',
  };
}

// ── Next run timestamp ────────────────────────────────────────────────────────

function computeNextRunAt(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case 'daily':   now.setDate(now.getDate() + 1); break;
    case 'monthly': now.setMonth(now.getMonth() + 1); break;
    default:        now.setDate(now.getDate() + 7);
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

  // ── Rate limit: one run per 30 seconds ──────────────────────────────────────
  try {
    const { data: lastRun } = await supabase
      .from('ai_decisions')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRun?.created_at) {
      const elapsed = Date.now() - new Date(lastRun.created_at).getTime();
      if (elapsed < 30_000) {
        return NextResponse.json(
          { error: 'Rate limited. Please wait 30 seconds between runs.', retry_after: Math.ceil((30_000 - elapsed) / 1000) },
          { status: 429 },
        );
      }
    }
  } catch { /* non-fatal: rate limit check failure should not block the run */ }

  try {
    // ── 1. Load autopilot settings ────────────────────────────────────────────
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

    // ── 2. Fetch account + positions (founder: Alpaca; non-founder: DB) ─────────
    const founderUser = isFounder(user.id, user.email);
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    let positions: AlpacaPosition[];
    let equity: number;
    let buyingPower: number;
    let cash: number;

    const [macroCtx, sectorData] = await Promise.all([
      getMacroContext().catch(() => null),
      fetchSectorMomentum().catch(() => ({
        sectors: [] as SectorMoment[], spyRet30d: 0, shyRet30d: 0, vixyPrice: 0,
      })),
    ]);

    if (founderUser) {
      const [account, alpacaPositions] = await Promise.all([getAccount(), getPositions()]);
      equity      = parseFloat(account.equity);
      buyingPower = parseFloat(account.buying_power);
      cash        = parseFloat(account.cash);
      positions   = alpacaPositions;
    } else {
      // Read from simulated DB
      const { data: acctRow } = await supabaseAdmin
        .from('user_accounts')
        .select('cash')
        .eq('user_id', user.id)
        .maybeSingle();
      cash = acctRow ? Number(acctRow.cash) : 100_000;

      const { data: holdingRows } = await supabaseAdmin
        .from('holdings')
        .select('*')
        .eq('user_id', user.id);
      const holdings = (holdingRows ?? []) as SyncedHolding[];

      const longMv = holdings.reduce((s, h) => s + h.market_value, 0);
      equity      = cash + longMv;
      buyingPower = cash;
      positions   = holdings.map(holdingToPosition);
    }

    // ── 3. Build full universe (watchlist + FULL_UNIVERSE) ────────────────────
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
    const universeKeys = [...new Set([...watchlistTickers, ...Object.keys(FULL_UNIVERSE)])];

    // ── 4. Fetch prices, sentiment, and earnings in parallel ─────────────────
    const heldTickers = positions.map((p) => p.symbol);
    const allTickers  = [...new Set([...heldTickers, ...universeKeys])];

    const [prices, sentimentScores, earningsData] = await Promise.all([
      getTickerPrices(allTickers),
      getSentimentScores(heldTickers).catch(() => ({})),
      getUpcomingEarnings(heldTickers).catch(() => []),
    ]);

    // ── 5. Derive macro signals ───────────────────────────────────────────────
    const vix = sectorData.vixyPrice > 0
      ? sectorData.vixyPrice
      : (macroCtx?.vix.vix ?? 0);

    const vixLabel     = getVixLabel(vix);
    const marketRegime = getMarketRegime(sectorData.spyRet30d, sectorData.shyRet30d);

    const topSectors    = sectorData.sectors.slice(0, 3);
    const bottomSectors = sectorData.sectors.slice(-3).reverse();

    // ── 6. Detect rebalancing needs ───────────────────────────────────────────
    const rebalAlerts = detectRebalancingNeeds(positions, equity, cash);

    // ── 7. Build prompt content ───────────────────────────────────────────────
    const macroSection     = macroCtx ? buildMacroPromptSection(macroCtx) : '';
    const sentimentSection = buildSentimentPromptSection(sentimentScores);
    const earningsSection  = buildEarningsPromptSection(earningsData);
    const portfolioText    = buildPortfolioText(
      equity, buyingPower, cash, positions, prices, universeKeys,
    );

    const systemPrompt = buildSystemPrompt({
      vixLabel,
      marketRegime,
      topSectors,
      bottomSectors,
      rebalAlerts,
      macroSection,
      maxTradeSize: Number(settings.max_trade_size),
      equity,
      buyingPower,
    });

    // ── 8. Call Claude ────────────────────────────────────────────────────────
    const fullSystemPrompt = systemPrompt + sentimentSection + earningsSection;
    const response = await anthropic.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 2048,
      system:     fullSystemPrompt,
      tools:      [ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_portfolio_analysis' },
      messages: [
        {
          role:    'user',
          content: `AutoPilot run initiated. Today's macro data and portfolio are below. Analyse the situation and return 4-6 specific trade recommendations that will improve diversification, capture sector momentum, and respect the risk mandate.\n\n${portfolioText}`,
        },
      ],
    });

    // ── 9. Parse Claude output ────────────────────────────────────────────────
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

    // ── 10. Apply risk guard ──────────────────────────────────────────────────
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
      watchlist:            universeKeys,
    };

    const { approved, rejected } = applyRiskGuard(recs, guardConfig, {
      portfolioValue:        equity,
      availableCash:         buyingPower,
      currentPositionValues,
      latestPrices,
    });

    // ── 11. Create recommendation rows for approved non-hold trades ───────────
    const recommendations: RecommendationResult[] = [];
    const decisions: AutopilotDecision[] = [];

    for (const rec of approved) {
      if (rec.action === 'hold') {
        recommendations.push({ symbol: rec.symbol, action: 'hold', qty: 0, status: 'hold' });
        decisions.push({ symbol: rec.symbol, action: 'hold', qty: 0, confidence: rec.confidence, reasoning: rec.reasoning, status: 'skipped' });
        continue;
      }

      try {
        await supabase.from('recommendations').insert({
          user_id:       user.id,
          ticker:        rec.symbol,
          action:        rec.action,
          qty:           rec.qty,
          reasoning:     rec.reasoning,
          confidence:    rec.confidence,
          source:        'autopilot',
          user_decision: 'pending',
        });
      } catch { /* non-fatal */ }

      recommendations.push({ symbol: rec.symbol, action: rec.action as 'buy' | 'sell', qty: rec.qty, status: 'pending_review' });
      decisions.push({ symbol: rec.symbol, action: rec.action as 'buy' | 'sell', qty: rec.qty, confidence: rec.confidence, reasoning: rec.reasoning, status: 'skipped' });
    }

    for (const rec of rejected) {
      decisions.push({
        symbol: rec.symbol, action: rec.action as 'buy' | 'sell' | 'hold', qty: rec.qty,
        confidence: rec.confidence, reasoning: rec.reasoning, status: 'rejected', error: rec.rejection_reason,
      });
    }

    // ── 12. Non-fatal: log decisions for attribution tracking ────────────────
    try {
      const decisionRows = approved
        .filter((r) => r.action !== 'hold')
        .map((r) => ({
          user_id:           user.id,
          session_type:      'autopilot' as const,
          symbol:            r.symbol,
          action:            r.action,
          qty:               r.qty,
          confidence:        r.confidence,
          reasoning_summary: r.reasoning?.slice(0, 500) ?? null,
          price_at_decision: latestPrices[r.symbol] ?? null,
          estimated_value:   null,
          risk_level:        r.risk_level ?? null,
          executed:          false,
        }));
      if (decisionRows.length > 0) {
        await supabase.from('ai_decisions').insert(decisionRows);
      }
    } catch { /* non-fatal */ }

    // ── 13. DB log ────────────────────────────────────────────────────────────
    const recommendedCount = recommendations.filter((r) => r.action !== 'hold').length;

    const { data: runRow, error: runErr } = await supabase
      .from('autopilot_runs')
      .insert({
        user_id:         user.id,
        trades_executed: recommendedCount,
        total_value:     0,
        market_outlook:  raw.market_outlook,
        summary:         raw.summary,
        decisions,
        status:          'completed',
      })
      .select()
      .single();

    if (runErr) console.error('[autopilot/run] run insert:', runErr.message);

    await supabase
      .from('autopilot_settings')
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: computeNextRunAt(settings.frequency ?? 'weekly'),
        updated_at:  new Date().toISOString(),
      })
      .eq('user_id', user.id);

    return NextResponse.json({
      run:             runRow as AutopilotRun | null,
      recommendations,
      market_outlook:  raw.market_outlook,
      summary:         raw.summary,
      macro_context: {
        vix:           vixLabel,
        market_regime: marketRegime,
        top_sectors:   topSectors,
        rebal_alerts:  rebalAlerts,
      },
    });
  } catch (err: unknown) {
    console.error('[autopilot/run]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
