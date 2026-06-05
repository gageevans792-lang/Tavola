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
