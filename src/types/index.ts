// ── Auth / User ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Profile {
  id: string;          // matches auth.users.id
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

// ── Risk ─────────────────────────────────────────────────────────────────────

export type RiskLevel = 'conservative' | 'balanced' | 'growth' | 'aggressive';

export interface RiskProfile {
  id: string;
  user_id: string;
  level: RiskLevel;
  created_at: string;
  updated_at: string;
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export interface Portfolio {
  id: string;
  user_id: string;
  alpaca_account_id: string | null;
  total_value: number;
  total_deposited: number;
  total_return: number;
  total_return_pct: number;
  created_at: string;
  updated_at: string;
}

// ── Deposits / Withdrawals ────────────────────────────────────────────────────

export type DepositStatus = 'pending' | 'completed' | 'failed';

export interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  stripe_session_id: string | null;
  status: DepositStatus;
  created_at: string;
}

export type WithdrawalStatus = 'pending' | 'completed' | 'failed';

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: WithdrawalStatus;
  created_at: string;
}

// ── Trades ────────────────────────────────────────────────────────────────────

export type TradeSide = 'buy' | 'sell';
export type TradeStatus = 'pending' | 'filled' | 'cancelled';

export interface Trade {
  id: string;
  user_id: string;
  ticker: string;
  side: TradeSide;
  qty: number;
  price: number | null;
  notional: number | null;
  alpaca_order_id: string | null;
  ai_reasoning: string | null;
  confidence_score: number | null;  // 0–100
  status: TradeStatus;
  created_at: string;
}

// ── AI Insights ───────────────────────────────────────────────────────────────

export type InsightType = 'buy' | 'sell' | 'hold' | 'rebalance' | 'outlook';

export interface AIInsight {
  id: string;
  user_id: string;
  type: InsightType;
  ticker: string | null;
  message: string;
  confidence_score: number | null;  // 0–100
  qty: number | null;               // shares to trade; null for outlook/rebalance
  executed: boolean;
  created_at: string;
}

// ── Holdings ──────────────────────────────────────────────────────────────────

export interface Holding {
  id: string;
  user_id: string;
  ticker: string;
  name: string | null;
  qty: number;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  weight_pct: number;
  updated_at: string;
}

// ── Alpaca ────────────────────────────────────────────────────────────────────

export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  cash: string;
  portfolio_value: string;
  equity: string;
  last_equity: string;
  buying_power: string;
  long_market_value: string;
  short_market_value: string;
  daytrade_count: number;
  pattern_day_trader: boolean;
  created_at: string;
}

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  qty: string;
  qty_available: string;
  avg_entry_price: string;
  side: TradeSide;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
  symbol: string;
  asset_class: string;
  qty: string;
  filled_qty: string;
  type: string;
  side: TradeSide;
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  filled_avg_price: string | null;
  status: string;
  extended_hours: boolean;
}

export interface AlpacaBar {
  t: string;   // timestamp (RFC-3339)
  o: number;   // open
  h: number;   // high
  l: number;   // low
  c: number;   // close
  v: number;   // volume
  n: number;   // trade count
  vw: number;  // volume-weighted average price
}

export interface AlpacaTrade {
  t: string;   // timestamp
  p: number;   // price
  s: number;   // size
  x: string;   // exchange
  i: number;   // trade id
  c: string[];  // conditions
  z: string;   // tape
}

export interface AlpacaQuote {
  t: string;   // timestamp
  ax: string;  // ask exchange
  ap: number;  // ask price
  as: number;  // ask size
  bx: string;  // bid exchange
  bp: number;  // bid price
  bs: number;  // bid size
  c: string[];  // conditions
  z: string;   // tape
}

export interface AlpacaSnapshot {
  latestTrade: AlpacaTrade;
  latestQuote: AlpacaQuote;
  minuteBar: AlpacaBar;
  dailyBar: AlpacaBar;
  prevDailyBar: AlpacaBar;
}

// ── Chart / UI helpers ────────────────────────────────────────────────────────

export interface PortfolioChartPoint {
  date: string;
  value: number;
}

export interface AllocationSlice {
  name: string;
  value: number;   // percentage, e.g. 42 = 42%
  color: string;   // hex or tailwind-compatible colour
}

// ── Auto-invest / AI analysis ─────────────────────────────────────────────────

export type TradeAction  = 'buy' | 'sell' | 'hold';
export type RiskGuardBlockReason =
  | 'low_confidence'
  | 'zero_qty'
  | 'no_price'
  | 'max_trade_value'
  | 'insufficient_cash'
  | 'max_position_pct'
  | 'no_position_to_sell';

export interface TradeRecommendation {
  symbol: string;
  action: TradeAction;
  qty: number;
  confidence: number;         // 0–100
  reasoning: string;
  risk_level: 'low' | 'medium' | 'high';
  estimated_value?: number;   // qty × price; set by risk guard
  // Feature 1: AI explains every decision
  catalyst?: string;
  expected_timeframe?: string;
  exit_condition?: string;
  risk_factors?: string[];
  institutional_context?: string;
}

export interface PortfolioAnalysis {
  recommendations: TradeRecommendation[];
  market_outlook: string;
  portfolio_health: PortfolioHealth;
  summary: string;
}

export type PortfolioHealth = 'poor' | 'fair' | 'good' | 'excellent';
export type InvestMode      = 'review' | 'auto';

export interface AutoInvestConfig {
  mode: InvestMode;
  max_position_pct: number;      // e.g. 0.05 = 5 %
  confidence_threshold: number;  // min score to approve
  max_trade_value: number;       // max USD per single trade
  watchlist: string[];
}

export interface RiskGuardResult {
  approved: TradeRecommendation[];
  rejected: RejectedRecommendation[];
}

export interface RejectedRecommendation extends TradeRecommendation {
  rejection_reason: string;
}

export interface ExecutedRecommendation extends TradeRecommendation {
  order_id: string;
}

export interface AutoInvestResult {
  analysis: PortfolioAnalysis;
  approved: TradeRecommendation[];
  executed: ExecutedRecommendation[];
  rejected: RejectedRecommendation[];
  errors: string[];
  portfolio: { value: number; cash: number };
}

// ── Stripe ────────────────────────────────────────────────────────────────────

export interface StripeCheckoutSession {
  url: string;
}

// ── Strategy / Autonomous ─────────────────────────────────────────────────────

export type StrategyRiskLevel = 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';

export interface UserStrategyPrefs {
  strategy_id: string;
  auto_execute: boolean;
  max_trade_value: number;
}

export interface AutonomousSessionRecord {
  id: string;
  strategy_id: string;
  strategy_name: string;
  status: 'running' | 'completed' | 'failed';
  auto_executed: boolean;
  trades_approved: number;
  trades_executed: number;
  total_trade_value: number;
  market_outlook: string | null;
  summary: string | null;
  warnings: string[];
  created_at: string;
}

export interface PortfolioAnalytics {
  win_rate: number;
  best_performer: { symbol: string; unrealized_plpc: number } | null;
  worst_performer: { symbol: string; unrealized_plpc: number } | null;
  concentration_risk: 'low' | 'medium' | 'high';
  total_unrealized_pl: number;
  total_unrealized_plpc: number;
  position_count: number;
  sector_exposure: Record<string, number>;
}
