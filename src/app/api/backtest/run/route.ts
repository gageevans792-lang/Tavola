import { NextResponse } from 'next/server';

// ── Types ──────────────────────────────────────────────────────────────────────

export type StrategyKey = 'conservative' | 'balanced' | 'growth' | 'aggressive';

export interface CrisisEvent {
  event: string;
  period: string;
  portfolio_return: number;
  sp500_return: number;
}

export interface EquityPoint {
  date: string;   // yyyy-mm-dd
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

// ── Static data — NO external API calls ───────────────────────────────────────

const ANNUAL_RETURNS: Record<string, Record<number, number>> = {
  VTI: {2010:17.3,2011:1.1,2012:16.4,2013:33.5,2014:12.6,2015:0.4,2016:12.7,2017:21.2,2018:-5.2,2019:30.7,2020:21.0,2021:25.7,2022:-19.5,2023:26.1,2024:23.8},
  QQQ: {2010:19.9,2011:3.0,2012:18.1,2013:36.6,2014:19.0,2015:9.4,2016:6.9,2017:32.7,2018:-0.1,2019:39.0,2020:48.6,2021:27.4,2022:-32.6,2023:54.9,2024:25.6},
  BND: {2010:6.4,2011:7.7,2012:4.2,2013:-2.0,2014:5.9,2015:0.4,2016:2.6,2017:3.5,2018:-0.1,2019:8.7,2020:7.7,2021:-1.7,2022:-13.1,2023:5.5,2024:1.8},
  GLD: {2010:29.5,2011:10.2,2012:7.0,2013:-28.3,2014:-1.5,2015:-10.4,2016:8.6,2017:13.1,2018:-1.9,2019:18.3,2020:25.1,2021:-3.6,2022:-0.8,2023:13.1,2024:26.8},
  VEA: {2010:7.8,2011:-12.1,2012:17.7,2013:22.8,2014:-5.1,2015:-0.8,2016:2.2,2017:27.2,2018:-14.7,2019:22.0,2020:10.6,2021:11.3,2022:-14.5,2023:18.2,2024:4.8},
  VWO: {2010:19.2,2011:-18.4,2012:18.6,2013:-5.0,2014:-3.9,2015:-14.9,2016:11.6,2017:31.7,2018:-14.6,2019:18.4,2020:15.8,2021:-2.7,2022:-17.9,2023:9.8,2024:7.4},
  SPY: {2010:15.1,2011:2.1,2012:16.0,2013:32.4,2014:13.7,2015:1.4,2016:12.0,2017:21.8,2018:-4.4,2019:31.5,2020:18.4,2021:28.7,2022:-18.2,2023:26.3,2024:25.0},
};

const STRATEGIES: Record<string, Record<string, number>> = {
  conservative: { BND:40, VTI:30, VEA:20, GLD:10 },
  balanced:     { VTI:50, BND:20, QQQ:15, VEA:15 },
  growth:       { VTI:60, QQQ:30, GLD:10 },
  aggressive:   { QQQ:50, VTI:30, VWO:20 },
};

const PERIOD_YEARS: Record<string, number[]> = {
  '5Y':        [2019,2020,2021,2022,2023,2024],
  '10Y':       [2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024],
  '15Y':       [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024],
  'since2008': [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024],
};

// Hardcoded crisis returns (%) per strategy for sub-annual periods
const CRISIS_HARDCODED: Record<string, Record<StrategyKey, number>> = {
  '2008': { conservative: -8,  balanced: -18, growth: -28, aggressive: -35 },
  'covid': { conservative: -12, balanced: -18, growth: -22, aggressive: -28 },
};

// ── Cache ─────────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: BacktestResult; exp: number }>();

function getCached(k: string): BacktestResult | null {
  const e = cache.get(k);
  if (!e || Date.now() > e.exp) { cache.delete(k); return null; }
  return e.data;
}

function setCache(k: string, data: BacktestResult): void {
  cache.set(k, { data, exp: Date.now() + 24 * 3_600_000 });
}

// ── Core computation ──────────────────────────────────────────────────────────

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1));
}

function monthDate(year: number, month: number): string {
  const d = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Compute weighted annual return for a given strategy weights and year
function yearReturn(weights: Record<string, number>, year: number): number {
  const total = Object.values(weights).reduce((s, w) => s + w, 0) || 100;
  return Object.entries(weights).reduce((ret, [sym, w]) => {
    return ret + (w / total) * (ANNUAL_RETURNS[sym]?.[year] ?? 0);
  }, 0);
}

function runBacktest(
  weights: Record<string, number>,
  years: number[],
  capital: number,
): {
  metrics:       StrategyMetrics;
  best_year:     { year: number; return_pct: number };
  worst_year:    { year: number; return_pct: number };
  equity_curve:  EquityPoint[];
  monthly_returns: MonthlyReturn[];
  annual_returns: { year: number; ret: number }[];
} {
  const annualRets: { year: number; ret: number }[] = [];
  const equity_curve: EquityPoint[] = [];
  const monthly_returns: MonthlyReturn[] = [];

  let value     = capital;
  let spyValue  = capital;
  let peak      = capital;
  let maxDD     = 0;

  for (const year of years) {
    const ret    = yearReturn(weights, year);
    const spyRet = ANNUAL_RETURNS['SPY']?.[year] ?? 0;
    const prevV  = value;
    const prevS  = spyValue;
    const endV   = prevV * (1 + ret / 100);
    const endS   = prevS * (1 + spyRet / 100);

    annualRets.push({ year, ret });

    // 12 monthly interpolated points (linear on value)
    for (let m = 1; m <= 12; m++) {
      const t  = m / 12;
      const mv = prevV + (endV - prevV) * t;
      const ms = prevS + (endS - prevS) * t;
      equity_curve.push({ date: monthDate(year, m), value: Math.round(mv), benchmark: Math.round(ms) });
      // Monthly return vs previous point
      const prevMv = m === 1 ? prevV : (prevV + (endV - prevV) * ((m - 1) / 12));
      monthly_returns.push({ year, month: m, return_pct: ((mv - prevMv) / prevMv) * 100 });
    }

    value    = endV;
    spyValue = endS;

    // Track drawdown on yearly values
    if (value > peak) peak = value;
    const dd = (peak - value) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const finalValue  = value;
  const totalReturn = (finalValue / capital - 1) * 100;
  const numYears    = years.length;
  const annualized  = ((finalValue / capital) ** (1 / numYears) - 1) * 100;

  // Sharpe: annual returns with 2% risk-free rate
  const retArr  = annualRets.map((r) => r.ret);
  const meanAnn = retArr.reduce((a, b) => a + b, 0) / (retArr.length || 1);
  const stdAnn  = stddev(retArr);
  const sharpe  = stdAnn > 0 ? (meanAnn - 2.0) / stdAnn : 0;

  const wins    = retArr.filter((r) => r > 0).length;
  const winRate = retArr.length > 0 ? (wins / retArr.length) * 100 : 0;

  let bestYear  = { year: 0, return_pct: -Infinity };
  let worstYear = { year: 0, return_pct:  Infinity };
  for (const { year, ret } of annualRets) {
    if (ret > bestYear.return_pct)  bestYear  = { year, return_pct: ret };
    if (ret < worstYear.return_pct) worstYear = { year, return_pct: ret };
  }

  return {
    metrics: {
      total_return_pct:      totalReturn,
      annualized_return_pct: annualized,
      sharpe_ratio:          sharpe,
      max_drawdown_pct:      maxDD * 100,
      win_rate_pct:          winRate,
      final_value:           finalValue,
    },
    best_year:       bestYear.year  > 0 ? bestYear  : { year: 0, return_pct: 0 },
    worst_year:      worstYear.year > 0 ? worstYear : { year: 0, return_pct: 0 },
    equity_curve,
    monthly_returns,
    annual_returns: annualRets,
  };
}

// ── Crisis performance ────────────────────────────────────────────────────────

function buildCrises(strategy: StrategyKey, years: number[]): CrisisEvent[] {
  const weights = STRATEGIES[strategy];
  const results: CrisisEvent[] = [];

  results.push({
    event: '2008 Financial Crisis',
    period: 'Oct 2007 – Mar 2009',
    portfolio_return: CRISIS_HARDCODED['2008'][strategy],
    sp500_return: -37.0,
  });

  results.push({
    event: 'COVID-19 Crash',
    period: 'Feb – Apr 2020',
    portfolio_return: CRISIS_HARDCODED['covid'][strategy],
    sp500_return: -34.0,
  });

  const annualCrises = [
    { year: 2022, event: '2022 Rate Shock', period: 'Jan – Dec 2022' },
    { year: 2023, event: '2023 AI Rally',   period: 'Jan – Dec 2023' },
  ];

  for (const { year, event, period } of annualCrises) {
    if (!years.includes(year)) continue;
    results.push({
      event,
      period,
      portfolio_return: yearReturn(weights, year),
      sp500_return:     ANNUAL_RETURNS['SPY']?.[year] ?? 0,
    });
  }

  return results;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: { strategy?: string; period?: string; initial_capital?: number };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  try {
    const strategy = (body.strategy ?? 'growth') as StrategyKey;
    const period   = body.period ?? '10Y';
    const capital  = typeof body.initial_capital === 'number' ? body.initial_capital : 100_000;

    if (!STRATEGIES[strategy]) {
      return NextResponse.json({ error: 'Unknown strategy' }, { status: 400 });
    }

    const cacheKey = `${strategy}-${period}-${capital}`;
    const cached   = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    const years   = PERIOD_YEARS[period] ?? PERIOD_YEARS['10Y'];
    const weights = STRATEGIES[strategy];

    const primary = runBacktest(weights, years, capital);

    const spyTotal = years.reduce((acc, yr) => acc * (1 + (ANNUAL_RETURNS['SPY']?.[yr] ?? 0) / 100), 1);
    const spyTotalReturnPct = (spyTotal - 1) * 100;

    const comparison = {} as Record<StrategyKey, StrategyMetrics>;
    for (const strat of Object.keys(STRATEGIES) as StrategyKey[]) {
      const r = runBacktest(STRATEGIES[strat], years, capital);
      comparison[strat] = r.metrics;
    }

    const result: BacktestResult = {
      strategy,
      start_date:            `${years[0]}-01-01`,
      end_date:              `${years[years.length - 1]}-12-31`,
      initial_capital:       capital,
      final_value:           primary.metrics.final_value,
      total_return_pct:      primary.metrics.total_return_pct,
      annualized_return_pct: primary.metrics.annualized_return_pct,
      vs_sp500_pct:          primary.metrics.total_return_pct - spyTotalReturnPct,
      sharpe_ratio:          primary.metrics.sharpe_ratio,
      max_drawdown_pct:      primary.metrics.max_drawdown_pct,
      win_rate_pct:          primary.metrics.win_rate_pct,
      best_year:             primary.best_year,
      worst_year:            primary.worst_year,
      equity_curve:          primary.equity_curve,
      monthly_returns:       primary.monthly_returns,
      crisis_performance:    buildCrises(strategy, years),
      comparison,
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[backtest/run]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
// deployed Tue Jun  9 11:43:38 UTC 2026
