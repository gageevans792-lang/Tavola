import Anthropic from '@anthropic-ai/sdk';
import { anthropic } from '@/lib/anthropic/client';
import { PortfolioAnalysis, TradeRecommendation } from '@/types';

// ── Input shape ────────────────────────────────────────────────────────────────

export interface PositionContext {
  symbol: string;
  qty: number;
  avg_entry: number;
  current_price: number;
  market_value: number;
  unrealized_pl_pct: number;
  daily_change_pct: number;
}

export interface AnalysisInput {
  cash: number;
  portfolio_value: number;
  positions: PositionContext[];
  watchlist: string[];
  watchlist_prices: Record<string, number>;
  risk_level: string;
  investment_goal: string;
}

// ── Tool definition — forces Claude to return structured output ─────────────────

const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_portfolio_analysis',
  description:
    'Submit a complete structured portfolio analysis with specific trade recommendations. Always call this tool with your full analysis.',
  input_schema: {
    type: 'object' as const,
    required: ['recommendations', 'market_outlook', 'portfolio_health', 'summary'],
    properties: {
      recommendations: {
        type: 'array',
        description: 'Specific trade recommendations. Include hold recommendations for unchanged positions.',
        items: {
          type: 'object',
          required: ['symbol', 'action', 'qty', 'confidence', 'reasoning', 'risk_level'],
          properties: {
            symbol: { type: 'string', description: 'Ticker symbol (e.g. AAPL)' },
            action: { type: 'string', enum: ['buy', 'sell', 'hold'] },
            qty: {
              type: 'number',
              minimum: 0,
              description: 'Number of shares. Must be 0 for hold actions.',
            },
            confidence: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Conviction score 0–100. Only recommend buy/sell above 65.',
            },
            reasoning: {
              type: 'string',
              description: '2–3 sentence rationale covering thesis, risks, and timing.',
            },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
      market_outlook: {
        type: 'string',
        description: 'Current macro/market context relevant to this portfolio (2–3 sentences).',
      },
      portfolio_health: {
        type: 'string',
        enum: ['poor', 'fair', 'good', 'excellent'],
      },
      summary: {
        type: 'string',
        description: 'Overall portfolio assessment and top priority actions (3–4 sentences).',
      },
    },
  },
};

// ── Prompts ─────────────────────────────────────────────────────────────────────

const RISK_GUIDANCE: Record<string, string> = {
  conservative:
    'Max 3% portfolio per new position. Prefer large-cap, dividend-paying, low-beta stocks. Avoid speculative plays. Capital preservation is the priority.',
  balanced:
    'Max 5% portfolio per new position. Mix of quality growth and value. Moderate volatility acceptable for fundamentally sound companies.',
  growth:
    'Max 8% portfolio per new position. Favor companies with strong revenue growth and expanding margins. Higher short-term volatility acceptable.',
  aggressive:
    'Max 10% portfolio per new position. Momentum, growth, and higher-risk plays are acceptable. Optimise for long-term total return.',
};

function systemPrompt(risk_level: string): string {
  return `You are a senior AI portfolio manager for Tavola, a sophisticated investment platform. You act with fiduciary responsibility.

Your mandate:
• Analyse the user's current holdings, cash position, and recent performance
• Consider macro context and sector concentration
• Generate specific, actionable trade recommendations aligned with the user's risk profile
• Never recommend trades purely for activity. Only act when there is genuine conviction.

Risk profile: ${risk_level.toUpperCase()}
${RISK_GUIDANCE[risk_level] ?? RISK_GUIDANCE.balanced}

Execution rules:
• Only recommend BUY when confidence ≥ 65 and sufficient cash exists
• Recommend SELL when a position has deteriorated fundamentally, is overconcentrated, or stop-loss logic applies
• HOLD signals your deliberate choice to maintain a position unchanged
• Qty for buy must be a whole number ≥ 1; qty for sell must not exceed current holding; qty for hold must be 0
• Do not recommend buying a symbol already at max allocation
• Provide reasoning that references actual data from the snapshot provided

Always call submit_portfolio_analysis with your complete analysis. Do not respond in plain text.`;
}

function userPrompt(input: AnalysisInput): string {
  const posBlock =
    input.positions.length > 0
      ? input.positions
          .map(
            (p) =>
              `  ${p.symbol.padEnd(6)} ${String(p.qty).padStart(6)} shares | ` +
              `Entry $${p.avg_entry.toFixed(2).padStart(8)} | ` +
              `Now $${p.current_price.toFixed(2).padStart(8)} | ` +
              `Value $${p.market_value.toFixed(0).padStart(9)} | ` +
              `P&L ${(p.unrealized_pl_pct * 100 >= 0 ? '+' : '') + (p.unrealized_pl_pct * 100).toFixed(1).padStart(7)}% | ` +
              `Today ${(p.daily_change_pct >= 0 ? '+' : '') + p.daily_change_pct.toFixed(2)}%`,
          )
          .join('\n')
      : '  (no current positions: deploy available cash)';

  const watchBlock =
    Object.keys(input.watchlist_prices).length > 0
      ? Object.entries(input.watchlist_prices)
          .map(([s, p]) => `  ${s.padEnd(6)} $${p.toFixed(2)}`)
          .join('\n')
      : '  (empty watchlist)';

  const cashPct = ((input.cash / input.portfolio_value) * 100).toFixed(1);
  const investedValue = (input.portfolio_value - input.cash).toFixed(2);

  return `PORTFOLIO SNAPSHOT
══════════════════
Total value : $${input.portfolio_value.toFixed(2)}
Cash        : $${input.cash.toFixed(2)} (${cashPct}% uninvested)
Invested    : $${investedValue}

CURRENT POSITIONS
══════════════════
${posBlock}

WATCHLIST: candidate buys
══════════════════
${watchBlock}

INVESTMENT GOAL
══════════════════
${input.investment_goal || 'Long-term wealth accumulation'}

Analyse this portfolio and call submit_portfolio_analysis with your recommendations.`;
}

// ── Public API ──────────────────────────────────────────────────────────────────

export async function analyzePortfolio(input: AnalysisInput): Promise<PortfolioAnalysis> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    system: systemPrompt(input.risk_level),
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: 'tool', name: 'submit_portfolio_analysis' },
    messages: [{ role: 'user', content: userPrompt(input) }],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );

  if (!toolBlock) {
    throw new Error('Claude did not return a structured portfolio analysis');
  }

  const raw = toolBlock.input as {
    recommendations: TradeRecommendation[];
    market_outlook: string;
    portfolio_health: PortfolioAnalysis['portfolio_health'];
    summary: string;
  };

  return raw;
}
