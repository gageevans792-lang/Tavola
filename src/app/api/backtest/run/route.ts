import { NextResponse } from 'next/server';
import {
  ANNUAL_RETURNS,
  STATIC_CRISES,
  getYears,
  type EtfSymbol,
} from '@/lib/backtest/historical-data';

// ── Types ──────────────────────────────────────────────────────────────────────

export type StrategyKey = 'conservative' | 'balanced' | 'growth' | 'aggressive';

export interface CrisisEvent {
  event: string;
  period: string;
  portfolio_return: number;
  sp500_return: number;
}

export interface EquityPoint {
  date: string;
  value: number;
  benchmark: number;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  return_pct: number;
}

export interface StrategyMetrics {
  total_return_pct: number;
  annualized_return_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  final_value: number;
}

export interface BacktestResult {
  strategy: StrategyKey;
  start_date: string;
  end_date: string;
  initial_capital: number;
  final_value: number;
  total_return_pct: number;
  annualized_return_pct: number;
  vs_sp500_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  best_year: { year: number; return_pct: number };
  worst_year: { year: number; return_pct: number };
  equity_curve: EquityPoint[];
  monthly_returns: MonthlyReturn[];
  crisis_performance: CrisisEvent[];
  comparison: Record<StrategyKey, StrategyMetrics>;
}

// ── Strategy allocations ───────────────────────────────────────────────────────

const STRATEGIES: Record<StrategyKey, Record<string, number>> = {
  conservative: { BND: 0.40, VTI: 0.30, VEA: 0.20, GLD: 0.10 },
  balanced:     { VTI: 0.50, BND: 0.20, QQQ: 0.15, VEA: 0.15 },
  growth:       { VTI: 0.60, QQQ: 0.30, GLD: 0.10 },
  aggressive:   { QQQ: 0.50, VTI: 0.30, VWO: 0.20 },
};

// ── Module-level cache (24h) ───────────────────────────────────────────────────

const resultCache = new Map<string, { data: BacktestResult; expires: number }>();

function getCached(key: string): BacktestResult | null {
  const entry = resultCache.get(key);
  if (!entry || Date.now() > entry.expires) { resultCache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: BacktestResult): void {
  resultCache.set(key, { data, expires: Date.now() + 24 * 3_600_000 });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (arr.length - 1));
}

function monthLastDay(year: number, month: number): string {
  const d = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ── Simulation ────────────────────────────────────────────────────────────────

interface SimResult {
  monthlyValues: { date: string; value: number }[];
  monthlyReturns: number[];
}

function simulate(
  allocation: Record<string, number>,
  years: number[],
  initialCapital: number,
): SimResult {
  const symbols = Object.keys(allocation);
  let value = initialCapital;
  const monthlyValues: { date: string; value: number }[] = [];
  const monthlyReturns: number[] = [];

  for (const year of years) {
    for (let m = 1; m <= 12; m++) {
      // Monthly return = weighted sum of each ETF's monthly return (annual / 12)
      let mRet = 0;
      for (const sym of symbols) {
        const annual = ANNUAL_RETURNS[sym as EtfSymbol]?.[year] ?? 0;
        mRet += allocation[sym] * (annual / 100 / 12);
      }
      value *= (1 + mRet);
      monthlyValues.push({ date: monthLastDay(year, m), value });
      monthlyReturns.push(mRet);
    }
  }

  return { monthlyValues, monthlyReturns };
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function computeMetrics(
  sim: SimResult,
  initialCapital: number,
  numYears: number,
): StrategyMetrics & {
  best_year:       { year: number; return_pct: number };
  worst_year:      { year: number; return_pct: number };
  monthly_returns: MonthlyReturn[];
} {
  const { monthlyValues, monthlyReturns } = sim;

  if (monthlyValues.length === 0) {
    return {
      total_return_pct: 0, annualized_return_pct: 0, sharpe_ratio: 0,
      max_drawdown_pct: 0, win_rate_pct: 0, final_value: initialCapital,
      best_year: { year: 0, return_pct: 0 }, worst_year: { year: 0, return_pct: 0 },
      monthly_returns: [],
    };
  }

  const finalValue  = monthlyValues[monthlyValues.length - 1].value;
  const totalReturn = (finalValue / initialCapital - 1) * 100;
  const annualized  = ((finalValue / initialCapital) ** (1 / numYears) - 1) * 100;

  // Max drawdown
  let peak = initialCapital;
  let maxDD = 0;
  for (const { value } of monthlyValues) {
    if (value > peak) peak = value;
    const dd = (peak - value) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const meanM  = monthlyReturns.reduce((a, b) => a + b, 0) / (monthlyReturns.length || 1);
  const stdM   = stddev(monthlyReturns);
  const sharpe = stdM > 0 ? (meanM / stdM) * Math.sqrt(12) : 0;
  const wins   = monthlyReturns.filter((r) => r > 0).length;
  const winRate = monthlyReturns.length > 0 ? (wins / monthlyReturns.length) * 100 : 0;

  // Monthly returns for heatmap
  const monthly_returns: MonthlyReturn[] = monthlyValues.map(({ date }, i) => ({
    year:       +date.slice(0, 4),
    month:      +date.slice(5, 7),
    return_pct: monthlyReturns[i] * 100,
  }));

  // Best / worst calendar year (by year-end values, 12-month chunks)
  let bestYear  = { year: 0, return_pct: -Infinity };
  let worstYear = { year: 0, return_pct:  Infinity };
  let prevVal   = initialCapital;

  for (let y = 0; y < monthlyValues.length; y += 12) {
    const yearEnd = monthlyValues[Math.min(y + 11, monthlyValues.length - 1)];
    const yr      = +yearEnd.date.slice(0, 4);
    const ret     = (yearEnd.value / prevVal - 1) * 100;
    if (ret > bestYear.return_pct)  bestYear  = { year: yr, return_pct: ret };
    if (ret < worstYear.return_pct) worstYear = { year: yr, return_pct: ret };
    prevVal = yearEnd.value;
  }

  return {
    total_return_pct:  totalReturn,
    annualized_return_pct: annualized,
    sharpe_ratio:      sharpe,
    max_drawdown_pct:  maxDD * 100,
    win_rate_pct:      winRate,
    final_value:       finalValue,
    best_year:         bestYear.year  > 0 ? bestYear  : { year: 0, return_pct: 0 },
    worst_year:        worstYear.year > 0 ? worstYear : { year: 0, return_pct: 0 },
    monthly_returns,
  };
}

// ── Crisis performance ────────────────────────────────────────────────────────

function computeCrises(
  allocation: Record<string, number>,
  years: number[],
): CrisisEvent[] {
  const results: CrisisEvent[] = [];

  // Static crises (2008 crash, COVID)
  for (const { event, period, sp500_return, etf_returns } of STATIC_CRISES) {
    let portfolio_return = 0;
    for (const [sym, weight] of Object.entries(allocation)) {
      portfolio_return += weight * (etf_returns[sym as EtfSymbol] ?? 0);
    }
    results.push({ event, period, portfolio_return, sp500_return });
  }

  // Annual crises from dataset (2022 rate shock, 2023 AI rally)
  const annualCrises = [
    { year: 2022, event: '2022 Rate Shock', period: 'Jan – Dec 2022' },
    { year: 2023, event: '2023 AI Rally',   period: 'Jan – Dec 2023' },
  ];

  for (const { year, event, period } of annualCrises) {
    if (!years.includes(year)) continue;
    let portfolio_return = 0;
    for (const [sym, weight] of Object.entries(allocation)) {
      portfolio_return += weight * (ANNUAL_RETURNS[sym as EtfSymbol]?.[year] ?? 0);
    }
    results.push({
      event,
      period,
      portfolio_return,
      sp500_return: ANNUAL_RETURNS.SPY[year],
    });
  }

  return results;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: { strategy?: string; period?: string; initial_capital?: number };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const strategy = (body.strategy as StrategyKey) ?? 'growth';
  const period   = body.period ?? '10Y';
  const capital  = typeof body.initial_capital === 'number' ? body.initial_capital : 100_000;

  if (!STRATEGIES[strategy]) {
    return NextResponse.json({ error: 'Unknown strategy' }, { status: 400 });
  }

  const cacheKey = `${strategy}-${period}-${capital}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  const years      = getYears(period);
  const allocation = STRATEGIES[strategy];
  const startDate  = `${years[0]}-01-01`;
  const endDate    = `${years[years.length - 1]}-12-31`;

  // Run simulations
  const primarySim = simulate(allocation, years, capital);
  const spySim     = simulate({ SPY: 1.0 }, years, capital);
  const primaryM   = computeMetrics(primarySim, capital, years.length);
  const spyM       = computeMetrics(spySim, capital, years.length);

  // Build equity curve (every 3rd monthly point to reduce payload)
  const spyMonthMap = new Map(spySim.monthlyValues.map((p) => [p.date.slice(0, 7), p.value]));
  const equityCurve: EquityPoint[] = primarySim.monthlyValues
    .filter((_, i) => i % 3 === 0 || i === primarySim.monthlyValues.length - 1)
    .map(({ date, value }) => ({
      date,
      value:     Math.round(value),
      benchmark: Math.round(spyMonthMap.get(date.slice(0, 7)) ?? capital),
    }));

  // Comparison for all 4 strategies
  const comparison = {} as Record<StrategyKey, StrategyMetrics>;
  for (const strat of Object.keys(STRATEGIES) as StrategyKey[]) {
    const sim = simulate(STRATEGIES[strat], years, capital);
    const m   = computeMetrics(sim, capital, years.length);
    comparison[strat] = {
      total_return_pct:      m.total_return_pct,
      annualized_return_pct: m.annualized_return_pct,
      sharpe_ratio:          m.sharpe_ratio,
      max_drawdown_pct:      m.max_drawdown_pct,
      win_rate_pct:          m.win_rate_pct,
      final_value:           m.final_value,
    };
  }

  const result: BacktestResult = {
    strategy,
    start_date:            startDate,
    end_date:              endDate,
    initial_capital:       capital,
    final_value:           primaryM.final_value,
    total_return_pct:      primaryM.total_return_pct,
    annualized_return_pct: primaryM.annualized_return_pct,
    vs_sp500_pct:          primaryM.annualized_return_pct - spyM.annualized_return_pct,
    sharpe_ratio:          primaryM.sharpe_ratio,
    max_drawdown_pct:      primaryM.max_drawdown_pct,
    win_rate_pct:          primaryM.win_rate_pct,
    best_year:             primaryM.best_year,
    worst_year:            primaryM.worst_year,
    equity_curve:          equityCurve,
    monthly_returns:       primaryM.monthly_returns,
    crisis_performance:    computeCrises(allocation, years),
    comparison,
  };

  setCache(cacheKey, result);
  return NextResponse.json(result);
}
