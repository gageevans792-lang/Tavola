import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

// ── Static historical annual returns (%) 2010–2024 ────────────────────────────

const HISTORICAL_RETURNS: Record<string, Record<number, number>> = {
  VTI: {2010:17.3,2011:1.1,2012:16.4,2013:33.5,2014:12.6,2015:0.4,2016:12.7,2017:21.2,2018:-5.2,2019:30.7,2020:21.0,2021:25.7,2022:-19.5,2023:26.1,2024:23.8},
  QQQ: {2010:19.9,2011:3.0,2012:18.1,2013:36.6,2014:19.0,2015:9.4,2016:6.9,2017:32.7,2018:-0.1,2019:39.0,2020:48.6,2021:27.4,2022:-32.6,2023:54.9,2024:25.6},
  BND: {2010:6.4,2011:7.7,2012:4.2,2013:-2.0,2014:5.9,2015:0.4,2016:2.6,2017:3.5,2018:-0.1,2019:8.7,2020:7.7,2021:-1.7,2022:-13.1,2023:5.5,2024:1.8},
  GLD: {2010:29.5,2011:10.2,2012:7.0,2013:-28.3,2014:-1.5,2015:-10.4,2016:8.6,2017:13.1,2018:-1.9,2019:18.3,2020:25.1,2021:-3.6,2022:-0.8,2023:13.1,2024:26.8},
  VEA: {2010:7.8,2011:-12.1,2012:17.7,2013:22.8,2014:-5.1,2015:-0.8,2016:2.2,2017:27.2,2018:-14.7,2019:22.0,2020:10.6,2021:11.3,2022:-14.5,2023:18.2,2024:4.8},
  VWO: {2010:19.2,2011:-18.4,2012:18.6,2013:-5.0,2014:-3.9,2015:-14.9,2016:11.6,2017:31.7,2018:-14.6,2019:18.4,2020:15.8,2021:-2.7,2022:-17.9,2023:9.8,2024:7.4},
  SPY: {2010:15.1,2011:2.1,2012:16.0,2013:32.4,2014:13.7,2015:1.4,2016:12.0,2017:21.8,2018:-4.4,2019:31.5,2020:18.4,2021:28.7,2022:-18.2,2023:26.3,2024:25.0},
};

// Weights in whole numbers (sum = 100); normalized to decimals internally
const STRATEGIES: Record<StrategyKey, Record<string, number>> = {
  conservative: { BND:40, VTI:30, VEA:20, GLD:10 },
  balanced:     { VTI:50, BND:20, QQQ:15, VEA:15 },
  growth:       { VTI:60, QQQ:30, GLD:10 },
  aggressive:   { QQQ:50, VTI:30, VWO:20 },
};

// Crisis events with ETF returns for sub-annual periods
const CRISIS_EVENTS = [
  {
    event: '2008 Financial Crisis',
    period: 'Oct 2007 – Mar 2009',
    sp500_return: -37.0,
    etf: { VTI:-30, QQQ:-33, BND:5, GLD:5, VEA:-45, VWO:-53, SPY:-37 } as Record<string,number>,
  },
  {
    event: 'COVID-19 Crash',
    period: 'Feb – Apr 2020',
    sp500_return: -34.0,
    etf: { VTI:-31, QQQ:-19, BND:3, GLD:4, VEA:-30, VWO:-25, SPY:-34 } as Record<string,number>,
  },
];

// ── Year ranges per period ─────────────────────────────────────────────────────

function getYears(period: string): number[] {
  switch (period) {
    case '5Y':        return [2019,2020,2021,2022,2023,2024];
    case '15Y':
    case 'since2008': return [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024];
    default:          return [2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024]; // 10Y
  }
}

// ── Module-level 24h cache ────────────────────────────────────────────────────

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

function monthEnd(year: number, month: number): string {
  const d = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

// ── Simulation ────────────────────────────────────────────────────────────────

interface SimResult {
  monthlyValues:  { date: string; value: number }[];
  monthlyReturns: number[];
}

function simulate(
  weights: Record<string, number>,  // whole-number weights summing to 100
  years: number[],
  initialCapital: number,
): SimResult {
  const symbols = Object.keys(weights);
  const total   = symbols.reduce((s, k) => s + weights[k], 0) || 100;
  let value     = initialCapital;
  const monthlyValues:  { date: string; value: number }[] = [];
  const monthlyReturns: number[] = [];

  for (const year of years) {
    for (let m = 1; m <= 12; m++) {
      let mRet = 0;
      for (const sym of symbols) {
        const annual = HISTORICAL_RETURNS[sym]?.[year] ?? 0;
        mRet += (weights[sym] / total) * (annual / 100 / 12);
      }
      value *= (1 + mRet);
      monthlyValues.push({ date: monthEnd(year, m), value });
      monthlyReturns.push(mRet);
    }
  }

  return { monthlyValues, monthlyReturns };
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function computeMetrics(sim: SimResult, initialCapital: number, numYears: number) {
  const { monthlyValues, monthlyReturns } = sim;

  if (!monthlyValues.length) {
    return {
      total_return_pct:0, annualized_return_pct:0, sharpe_ratio:0,
      max_drawdown_pct:0, win_rate_pct:0, final_value:initialCapital,
      best_year:{year:0,return_pct:0}, worst_year:{year:0,return_pct:0},
      monthly_returns: [] as MonthlyReturn[],
    };
  }

  const finalValue  = monthlyValues[monthlyValues.length - 1].value;
  const totalReturn = (finalValue / initialCapital - 1) * 100;
  const annualized  = ((finalValue / initialCapital) ** (1 / numYears) - 1) * 100;

  let peak = initialCapital, maxDD = 0;
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

  const monthly_returns: MonthlyReturn[] = monthlyValues.map(({ date }, i) => ({
    year:       +date.slice(0, 4),
    month:      +date.slice(5, 7),
    return_pct: monthlyReturns[i] * 100,
  }));

  // Best / worst calendar year
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
    total_return_pct:      totalReturn,
    annualized_return_pct: annualized,
    sharpe_ratio:          sharpe,
    max_drawdown_pct:      maxDD * 100,
    win_rate_pct:          winRate,
    final_value:           finalValue,
    best_year:             bestYear.year  > 0 ? bestYear  : { year: 0, return_pct: 0 },
    worst_year:            worstYear.year > 0 ? worstYear : { year: 0, return_pct: 0 },
    monthly_returns,
  };
}

// ── Crisis performance ────────────────────────────────────────────────────────

function buildCrises(weights: Record<string, number>, years: number[]): CrisisEvent[] {
  const total   = Object.values(weights).reduce((a, b) => a + b, 0) || 100;
  const results: CrisisEvent[] = [];

  for (const { event, period, sp500_return, etf } of CRISIS_EVENTS) {
    let portfolio_return = 0;
    for (const [sym, w] of Object.entries(weights)) {
      portfolio_return += (w / total) * (etf[sym] ?? 0);
    }
    results.push({ event, period, portfolio_return, sp500_return });
  }

  // 2022 and 2023 from the annual dataset
  const annualCrises = [
    { year: 2022, event: '2022 Rate Shock', period: 'Jan – Dec 2022' },
    { year: 2023, event: '2023 AI Rally',   period: 'Jan – Dec 2023' },
  ];
  for (const { year, event, period } of annualCrises) {
    if (!years.includes(year)) continue;
    let portfolio_return = 0;
    for (const [sym, w] of Object.entries(weights)) {
      portfolio_return += (w / total) * (HISTORICAL_RETURNS[sym]?.[year] ?? 0);
    }
    results.push({
      event,
      period,
      portfolio_return,
      sp500_return: HISTORICAL_RETURNS['SPY']?.[year] ?? 0,
    });
  }

  return results;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { strategy?: string; period?: string; start_date?: string; initial_capital?: number };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const strategy = (body.strategy ?? 'growth') as StrategyKey;
    const capital  = typeof body.initial_capital === 'number' ? body.initial_capital : 100_000;

    if (!STRATEGIES[strategy]) {
      return NextResponse.json({ error: 'Unknown strategy' }, { status: 400 });
    }

    // Accept either period key or derive from start_date
    let period = body.period ?? '10Y';
    if (!body.period && body.start_date) {
      const startYear = +body.start_date.slice(0, 4);
      const span      = 2024 - startYear;
      if (span <= 6)       period = '5Y';
      else if (span <= 11) period = '10Y';
      else                 period = '15Y';
    }

    const cacheKey = `${strategy}-${period}-${capital}`;
    const cached   = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    const years      = getYears(period);
    const weights    = STRATEGIES[strategy];
    const startDate  = `${years[0]}-01-01`;
    const endDate    = `${years[years.length - 1]}-12-31`;

    const primarySim = simulate(weights, years, capital);
    const spySim     = simulate({ SPY: 100 }, years, capital);
    const primaryM   = computeMetrics(primarySim, capital, years.length);
    const spyM       = computeMetrics(spySim,     capital, years.length);

    const spyMonthMap = new Map(spySim.monthlyValues.map((p) => [p.date.slice(0, 7), p.value]));
    const equityCurve: EquityPoint[] = primarySim.monthlyValues
      .filter((_, i) => i % 3 === 0 || i === primarySim.monthlyValues.length - 1)
      .map(({ date, value }) => ({
        date,
        value:     Math.round(value),
        benchmark: Math.round(spyMonthMap.get(date.slice(0, 7)) ?? capital),
      }));

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
      crisis_performance:    buildCrises(weights, years),
      comparison,
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[backtest/run]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
