export interface InvestmentStrategy {
  id: string;
  name: string;
  tagline: string;
  description: string;
  risk_level: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  target_return_pct: number;
  max_drawdown_pct: number;
  confidence_threshold: number;
  max_position_pct: number;
  max_trade_value: number;
  accent_color: string;
  characteristics: string[];
  system_prompt: string;
}

export const STRATEGIES: InvestmentStrategy[] = [
  {
    id: 'growth',
    name: 'Growth Accelerator',
    tagline: 'Ride the wave of high-momentum innovators',
    description:
      'Targets high-momentum technology, AI, and innovation leaders with accelerating revenue growth. Accepts elevated volatility in pursuit of superior long-term returns.',
    risk_level: 'aggressive',
    target_return_pct: 10,
    max_drawdown_pct: 20,
    confidence_threshold: 70,
    max_position_pct: 0.25,
    max_trade_value: 5000,
    accent_color: '#B8960C',
    characteristics: [
      'High-momentum tech & AI focus',
      'Accelerating revenue leaders',
      'Elevated volatility tolerance',
      'Concentrated position sizing',
    ],
    system_prompt:
      'Focus on high-momentum technology, AI, and innovation leaders with accelerating revenue. Accept higher volatility in exchange for superior growth potential. Prioritize companies with strong earnings beats, expanding margins, and dominant market positioning in secular growth sectors.',
  },
  {
    id: 'balanced',
    name: 'Balanced Wealth',
    tagline: 'Steady growth across diversified sectors',
    description:
      'Diversifies across sectors by blending growth equities with stable dividend-paying companies. Prefers strong balance sheets and consistent cash flow generation.',
    risk_level: 'moderate',
    target_return_pct: 7,
    max_drawdown_pct: 12,
    confidence_threshold: 75,
    max_position_pct: 0.15,
    max_trade_value: 3000,
    accent_color: '#3B82F6',
    characteristics: [
      'Multi-sector diversification',
      'Growth + dividend blend',
      'Strong balance sheet focus',
      'Moderate position sizing',
    ],
    system_prompt:
      'Diversify across sectors, blending growth equities with stable dividend-paying companies. Prefer strong balance sheets, consistent free cash flow, and companies with durable competitive moats. Avoid excessive concentration in any single sector or theme.',
  },
  {
    id: 'income',
    name: 'Dividend Income',
    tagline: 'Capital preservation with reliable income',
    description:
      'Targets dividend-yielding equities with healthy payout ratios. Focuses on Utilities, Consumer Staples, Healthcare, and REITs where capital preservation is paramount.',
    risk_level: 'conservative',
    target_return_pct: 5,
    max_drawdown_pct: 8,
    confidence_threshold: 80,
    max_position_pct: 0.12,
    max_trade_value: 2000,
    accent_color: '#22C55E',
    characteristics: [
      'Yield >2.5% requirement',
      'Payout ratio <75%',
      'Utilities / Staples / Healthcare / REITs',
      'Capital preservation paramount',
    ],
    system_prompt:
      'Prioritize equities with dividend yields above 2.5% and payout ratios below 75%. Focus on Utilities, Consumer Staples, Healthcare, and REITs. Capital preservation is paramount. Avoid speculative positions. Only recommend buy or sell when there is high conviction supported by yield sustainability and balance sheet strength.',
  },
  {
    id: 'momentum',
    name: 'Market Momentum',
    tagline: 'Buy strength, cut weakness, follow the flow',
    description:
      'Follows price momentum and sector rotation signals. Uses price action and volume as primary inputs to buy into strength and exit weakness with discipline.',
    risk_level: 'aggressive',
    target_return_pct: 10,
    max_drawdown_pct: 18,
    confidence_threshold: 72,
    max_position_pct: 0.20,
    max_trade_value: 4000,
    accent_color: '#A855F7',
    characteristics: [
      'Price momentum primary signal',
      'Sector rotation awareness',
      'Volume confirmation required',
      'Buy strength, cut weakness',
    ],
    system_prompt:
      'Buy strength and cut weakness. Follow price momentum and sector rotation dynamics, using price action and volume as key signals. Favor positions showing relative strength versus the broad market. Be willing to exit underperforming positions quickly and reallocate to emerging momentum leaders.',
  },
  {
    id: 'ai_conviction',
    name: 'AI Conviction',
    tagline: 'Full analytical freedom, maximum conviction',
    description:
      'Unleashes the full analytical arsenal: technical, fundamental, macro, and sentiment, with no sector constraints. Built for investors seeking maximum AI-driven alpha.',
    risk_level: 'very_aggressive',
    target_return_pct: 13,
    max_drawdown_pct: 25,
    confidence_threshold: 65,
    max_position_pct: 0.25,
    max_trade_value: 5000,
    accent_color: '#EF4444',
    characteristics: [
      'Full technical analysis (RSI, MACD)',
      'Fundamental + macro + sentiment',
      'No sector constraints',
      'Maximum alpha pursuit',
    ],
    system_prompt:
      'Apply full analytical freedom: technical analysis (RSI, MACD, support/resistance levels), fundamental analysis, macro environment assessment, and market sentiment. No sector constraints. Identify the highest-conviction opportunities regardless of category, using every analytical lens available to generate maximum alpha.',
  },
];

export const DEFAULT_STRATEGY_ID = 'balanced';

export function getStrategy(id: string): InvestmentStrategy {
  const strategy = STRATEGIES.find((s) => s.id === id);
  if (!strategy) {
    return STRATEGIES.find((s) => s.id === DEFAULT_STRATEGY_ID)!;
  }
  return strategy;
}
