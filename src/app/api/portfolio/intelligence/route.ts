import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/anthropic/client';
import { getAccount } from '@/lib/alpaca/client';
import { getBasicFinancials, getSentiment } from '@/lib/finnhub/client';
import type { FinnhubBasicFinancials, FinnhubSentiment } from '@/lib/finnhub/client';

// ── Sector map (GICS-aligned) ─────────────────────────────────────────────────

const TICKER_SECTOR: Record<string, string> = {
  // Technology
  AAPL: 'Technology',  MSFT: 'Technology',  NVDA: 'Technology',  AMD: 'Technology',
  INTC: 'Technology',  ORCL: 'Technology',  CSCO: 'Technology',  QCOM: 'Technology',
  AVGO: 'Technology',  TSM:  'Technology',  CRM:  'Technology',  ADBE: 'Technology',
  SNOW: 'Technology',  PLTR: 'Technology',  IBM:  'Technology',  TXN:  'Technology',
  AMAT: 'Technology',  NOW:  'Technology',  MU:   'Technology',  LRCX: 'Technology',
  // Communication Services
  GOOGL: 'Communication Services', GOOG: 'Communication Services',
  META:  'Communication Services', NFLX: 'Communication Services',
  DIS:   'Communication Services', T:    'Communication Services',
  VZ:    'Communication Services', CMCSA:'Communication Services',
  SNAP:  'Communication Services', SPOT: 'Communication Services',
  // Consumer Discretionary
  TSLA: 'Consumer Discretionary', AMZN: 'Consumer Discretionary',
  HD:   'Consumer Discretionary', MCD:  'Consumer Discretionary',
  NKE:  'Consumer Discretionary', SBUX: 'Consumer Discretionary',
  LOW:  'Consumer Discretionary', TGT:  'Consumer Discretionary',
  F:    'Consumer Discretionary', GM:   'Consumer Discretionary',
  BKNG: 'Consumer Discretionary', RCL:  'Consumer Discretionary',
  // Consumer Staples
  PG:   'Consumer Staples', KO:   'Consumer Staples', PEP:  'Consumer Staples',
  WMT:  'Consumer Staples', COST: 'Consumer Staples', PM:   'Consumer Staples',
  MDLZ: 'Consumer Staples', CL:   'Consumer Staples', MO:   'Consumer Staples',
  // Financials
  JPM:  'Financials', BAC:  'Financials', WFC:  'Financials', GS:   'Financials',
  MS:   'Financials', V:    'Financials', MA:   'Financials', AXP:  'Financials',
  BLK:  'Financials', SCHW: 'Financials', C:    'Financials', PGR:  'Financials',
  COF:  'Financials', SPGI: 'Financials',
  // Healthcare
  JNJ:  'Healthcare', PFE:  'Healthcare', UNH:  'Healthcare', ABBV: 'Healthcare',
  MRK:  'Healthcare', LLY:  'Healthcare', BMY:  'Healthcare', AMGN: 'Healthcare',
  GILD: 'Healthcare', CVS:  'Healthcare', ISRG: 'Healthcare', TMO:  'Healthcare',
  DHR:  'Healthcare', MDT:  'Healthcare',
  // Energy
  XOM:  'Energy', CVX:  'Energy', COP:  'Energy', SLB:  'Energy',
  EOG:  'Energy', OXY:  'Energy', PSX:  'Energy', MPC:  'Energy',
  // Industrials
  BA:   'Industrials', CAT:  'Industrials', GE:   'Industrials', HON:  'Industrials',
  MMM:  'Industrials', RTX:  'Industrials', UPS:  'Industrials', FDX:  'Industrials',
  DE:   'Industrials', LMT:  'Industrials', NOC:  'Industrials',
  // Utilities
  NEE:  'Utilities', DUK:  'Utilities', SO:   'Utilities', AEP:  'Utilities', XEL: 'Utilities',
  // Real Estate
  AMT:  'Real Estate', PLD: 'Real Estate', EQIX: 'Real Estate', CCI: 'Real Estate',
  // Materials
  LIN:  'Materials', APD: 'Materials', SHW: 'Materials', FCX: 'Materials', NEM: 'Materials',
};

// ── Shared types ──────────────────────────────────────────────────────────────

export interface HoldingAnalysis {
  ticker:              string;
  weight_pct:          number;
  beta:                number;
  pe_ratio:            number;
  week52_high:         number;
  week52_low:          number;
  current_vs_52w_high: number;
  sentiment_score:     number;
  sentiment_label:     'Very Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Very Bearish';
  ai_thesis:           string;
}

export interface RebalancingSuggestion {
  ticker: string;
  action: 'reduce' | 'increase' | 'hold';
  reason: string;
}

export interface IntelligenceResponse {
  health_score:          number;
  risk_score:            number;
  concentration_risk:    'low' | 'medium' | 'high';
  sector_exposure:       { sector: string; pct: number }[];
  correlation_warning:   boolean;
  diversification_score: number;
  holdings_analysis:     HoldingAnalysis[];
  rebalancing_suggestions: RebalancingSuggestion[];
  portfolio_summary:     string;
  generated_at:          string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sentimentScore(data: FinnhubSentiment | null): number {
  if (!data?.sentiment) return 50;
  const { bullishPercent, bearishPercent } = data.sentiment;
  const total = bullishPercent + bearishPercent;
  if (total <= 0) return 50;
  return Math.round((bullishPercent / total) * 100);
}

function sentimentLabel(score: number): HoldingAnalysis['sentiment_label'] {
  if (score >= 70) return 'Very Bullish';
  if (score >= 57) return 'Bullish';
  if (score >= 43) return 'Neutral';
  if (score >= 30) return 'Bearish';
  return 'Very Bearish';
}

function vsHigh(currentPrice: number, high52w: number): number {
  if (!high52w || !currentPrice) return 0;
  return Math.max(0, ((high52w - currentPrice) / high52w) * 100);
}

function computeRiskScore(holdings: Array<{ weight_pct: number; beta: number }>): number {
  if (!holdings.length) return 50;
  const portfolioBeta = holdings.reduce((sum, h) => sum + (h.weight_pct / 100) * h.beta, 0);
  return Math.min(100, Math.round(portfolioBeta * 50));
}

function computeDiversificationScore(
  holdings: Array<{ weight_pct: number }>,
  sectorCount: number,
): number {
  if (!holdings.length) return 0;
  const hhi = holdings.reduce((sum, h) => sum + Math.pow(h.weight_pct / 100, 2), 0);
  const hhiScore  = Math.round((1 - hhi) * 50);
  const sectorScore = Math.round(Math.min(sectorCount / 7, 1) * 50);
  return Math.min(100, hhiScore + sectorScore);
}

function buildSectorExposure(
  holdings: Array<{ ticker: string; weight_pct: number }>,
): { sector: string; pct: number }[] {
  const map = new Map<string, number>();
  for (const h of holdings) {
    const sector = TICKER_SECTOR[h.ticker] ?? 'Other';
    map.set(sector, (map.get(sector) ?? 0) + Number(h.weight_pct));
  }
  return [...map.entries()]
    .map(([sector, pct]) => ({ sector, pct: Math.round(pct * 10) / 10 }))
    .sort((a, b) => b.pct - a.pct);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: rawHoldings } = await supabase
    .from('holdings')
    .select('ticker, current_price, market_value, weight_pct, unrealized_plpc')
    .eq('user_id', user.id)
    .order('market_value', { ascending: false });

  const holdings = (rawHoldings ?? []) as Array<{
    ticker: string;
    current_price: number | string;
    market_value:  number | string;
    weight_pct:    number | string;
    unrealized_plpc: number | string;
  }>;

  if (holdings.length === 0) {
    return NextResponse.json({
      health_score: 0, risk_score: 0, concentration_risk: 'low',
      sector_exposure: [], correlation_warning: false,
      diversification_score: 0, holdings_analysis: [],
      rebalancing_suggestions: [], portfolio_summary: 'No holdings to analyze.',
      generated_at: new Date().toISOString(),
    } satisfies IntelligenceResponse);
  }

  const tickers = holdings.map((h) => h.ticker);

  // Parallel: Finnhub data per ticker + Alpaca account
  const [financialsResults, sentimentResults, accountResult] = await Promise.all([
    Promise.allSettled(tickers.map((t) => getBasicFinancials(t))),
    Promise.allSettled(tickers.map((t) => getSentiment(t))),
    getAccount().catch(() => null),
  ]);

  const financialsMap = new Map<string, FinnhubBasicFinancials | null>(
    tickers.map((t, i) => [
      t,
      financialsResults[i].status === 'fulfilled' ? financialsResults[i].value : null,
    ]),
  );
  const sentimentMap = new Map<string, FinnhubSentiment | null>(
    tickers.map((t, i) => [
      t,
      sentimentResults[i].status === 'fulfilled' ? sentimentResults[i].value : null,
    ]),
  );

  const equity = accountResult
    ? `$${Math.round(parseFloat(accountResult.equity)).toLocaleString()}`
    : 'unknown';

  // Build preliminary holdings analysis (no ai_thesis yet)
  const preliminaryAnalysis = holdings.map((h): Omit<HoldingAnalysis, 'ai_thesis'> => {
    const fin      = financialsMap.get(h.ticker);
    const sent     = sentimentMap.get(h.ticker);
    const beta     = fin?.metric?.beta ?? 1;
    const score    = sentimentScore(sent ?? null);
    const high52w  = fin?.metric?.['52WeekHigh'] ?? 0;

    return {
      ticker:              h.ticker,
      weight_pct:          Math.round(Number(h.weight_pct) * 10) / 10,
      beta:                Math.round(beta * 100) / 100,
      pe_ratio:            Math.round((fin?.metric?.peBasicExclExtraTTM ?? 0) * 10) / 10,
      week52_high:         Math.round(high52w * 100) / 100,
      week52_low:          Math.round((fin?.metric?.['52WeekLow'] ?? 0) * 100) / 100,
      current_vs_52w_high: Math.round(vsHigh(Number(h.current_price), high52w) * 10) / 10,
      sentiment_score:     score,
      sentiment_label:     sentimentLabel(score),
    };
  });

  // Risk metrics
  const sectorExposure = buildSectorExposure(
    holdings.map((h) => ({ ticker: h.ticker, weight_pct: Number(h.weight_pct) })),
  );
  const sectorCount    = sectorExposure.length;
  const maxWeight      = Math.max(...holdings.map((h) => Number(h.weight_pct)));

  const riskScore      = computeRiskScore(preliminaryAnalysis);
  const divScore       = computeDiversificationScore(preliminaryAnalysis, sectorCount);
  const concRisk: IntelligenceResponse['concentration_risk'] =
    maxWeight > 40 ? 'high' : maxWeight > 25 ? 'medium' : 'low';
  const corrWarn       = sectorExposure.some((s) => s.pct > 70);
  const avgSentiment   = Math.round(
    preliminaryAnalysis.reduce((s, h) => s + h.sentiment_score, 0) / preliminaryAnalysis.length,
  );
  const healthScore    = Math.round(
    divScore * 0.4 + (100 - riskScore) * 0.3 + avgSentiment * 0.3,
  );

  // Build Claude prompt
  const holdingsSummary = preliminaryAnalysis.map((h) =>
    `${h.ticker}: weight=${h.weight_pct}%, beta=${h.beta}, PE=${h.pe_ratio || 'N/A'}, ` +
    `${h.current_vs_52w_high.toFixed(1)}% below 52w high, sentiment=${h.sentiment_label}`,
  ).join('\n');

  const prompt =
    `Portfolio equity: ${equity}\n` +
    `Portfolio beta: ${(riskScore / 50).toFixed(2)}\n` +
    `Concentration risk: ${concRisk}\n` +
    `Top sectors: ${sectorExposure.slice(0, 3).map((s) => `${s.sector} ${s.pct}%`).join(', ')}\n\n` +
    `Holdings:\n${holdingsSummary}`;

  // Claude tool_use for AI content
  let aiTheses: Map<string, string>     = new Map();
  let rebalancingSuggestions:            RebalancingSuggestion[] = [];
  let portfolioSummary                 = '';

  try {
    const aiResp = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      tools: [{
        name: 'submit_analysis',
        description: 'Submit structured portfolio intelligence analysis',
        input_schema: {
          type: 'object' as const,
          properties: {
            holdings_theses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ticker:    { type: 'string' },
                  ai_thesis: { type: 'string', description: 'One sentence institutional investment thesis' },
                },
                required: ['ticker', 'ai_thesis'],
              },
            },
            rebalancing_suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ticker: { type: 'string' },
                  action: { type: 'string', enum: ['reduce', 'increase', 'hold'] },
                  reason: { type: 'string', description: 'One sentence reason' },
                },
                required: ['ticker', 'action', 'reason'],
              },
            },
            portfolio_summary: {
              type: 'string',
              description: '2-3 sentence institutional portfolio assessment',
            },
          },
          required: ['holdings_theses', 'rebalancing_suggestions', 'portfolio_summary'],
        },
      }],
      tool_choice: { type: 'tool', name: 'submit_analysis' },
      system: `You are Tavola's Chief Portfolio Analyst. Provide institutional-grade, direct, confident analysis. No hedging. No emojis. Speak like a Goldman Sachs portfolio manager.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const toolBlock = aiResp.content.find((b) => b.type === 'tool_use');
    if (toolBlock?.type === 'tool_use') {
      const output = toolBlock.input as {
        holdings_theses:         Array<{ ticker: string; ai_thesis: string }>;
        rebalancing_suggestions: Array<{ ticker: string; action: string; reason: string }>;
        portfolio_summary:       string;
      };

      for (const t of (output.holdings_theses ?? [])) {
        aiTheses.set(t.ticker, t.ai_thesis);
      }

      rebalancingSuggestions = (output.rebalancing_suggestions ?? []).map((r) => ({
        ticker: r.ticker,
        action: (r.action as 'reduce' | 'increase' | 'hold') ?? 'hold',
        reason: r.reason,
      }));

      portfolioSummary = output.portfolio_summary ?? '';
    }
  } catch (err) {
    console.warn('[intelligence] Claude error:', err instanceof Error ? err.message : err);
    portfolioSummary = 'Portfolio analysis temporarily unavailable. Quantitative metrics are current.';
  }

  // Assemble final holdings_analysis
  const holdingsAnalysis: HoldingAnalysis[] = preliminaryAnalysis.map((h) => ({
    ...h,
    ai_thesis: aiTheses.get(h.ticker) ?? `${h.ticker} represents a ${h.weight_pct.toFixed(1)}% portfolio position.`,
  }));

  return NextResponse.json({
    health_score:            healthScore,
    risk_score:              riskScore,
    concentration_risk:      concRisk,
    sector_exposure:         sectorExposure,
    correlation_warning:     corrWarn,
    diversification_score:   divScore,
    holdings_analysis:       holdingsAnalysis,
    rebalancing_suggestions: rebalancingSuggestions,
    portfolio_summary:       portfolioSummary,
    generated_at:            new Date().toISOString(),
  } satisfies IntelligenceResponse);
}
