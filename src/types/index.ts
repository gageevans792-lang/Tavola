export interface User {
  id: string;
  email: string;
  full_name: string;
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  investment_goal: string;
  created_at: string;
}

export interface Portfolio {
  total_value: number;
  cash: number;
  equity: number;
  day_pl: number;
  day_pl_percent: number;
  total_pl: number;
  total_pl_percent: number;
}

export interface Holding {
  symbol: string;
  name: string;
  qty: number;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  change_today: number;
}

export interface Order {
  id: string;
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: string;
  status: string;
  filled_avg_price: number | null;
  created_at: string;
}

export interface AIInsight {
  id: string;
  type: 'analysis' | 'recommendation' | 'alert';
  title: string;
  content: string;
  symbol?: string;
  created_at: string;
}

export interface AllocationItem {
  name: string;
  value: number;
  color: string;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}

export interface StripeSession {
  url: string;
}

// ── Auto-invest ──────────────────────────────────────────────

export type TradeAction = 'buy' | 'sell' | 'hold';
export type RiskLevel = 'low' | 'medium' | 'high';
export type PortfolioHealth = 'poor' | 'fair' | 'good' | 'excellent';
export type InvestMode = 'review' | 'auto';

export interface TradeRecommendation {
  symbol: string;
  action: TradeAction;
  qty: number;
  confidence: number;        // 0–100
  reasoning: string;
  risk_level: RiskLevel;
  estimated_value?: number;  // qty * price, set by risk guard
}

export interface PortfolioAnalysis {
  recommendations: TradeRecommendation[];
  market_outlook: string;
  portfolio_health: PortfolioHealth;
  summary: string;
}

export interface AutoInvestConfig {
  mode: InvestMode;
  max_position_pct: number;      // e.g. 0.05 = 5% of portfolio
  confidence_threshold: number;  // min score to approve, e.g. 70
  max_trade_value: number;       // max $ per single trade, e.g. 2000
  watchlist: string[];           // symbols Claude can recommend buying
}

export interface RejectedRecommendation extends TradeRecommendation {
  rejection_reason: string;
}

export interface ExecutedRecommendation extends TradeRecommendation {
  order_id: string;
}

export interface AutoInvestResult {
  analysis: PortfolioAnalysis;
  approved: TradeRecommendation[];       // review mode — pending user approval
  executed: ExecutedRecommendation[];    // auto mode — already placed
  rejected: RejectedRecommendation[];    // blocked by risk guard
  errors: string[];
  portfolio: { value: number; cash: number };
}
