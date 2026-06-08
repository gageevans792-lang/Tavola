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

// ── Allocations ───────────────────────────────────────────────────────────────

const STRATEGIES: Record<StrategyKey, Record<string, number>> = {
  conservative: { BND: 0.40, VTI: 0.30, VEA: 0.20, GLD: 0.10 },
  balanced:     { VTI: 0.50, BND: 0.20, QQQ: 0.15, VEA: 0.15 },
  growth:       { VTI: 0.60, QQQ: 0.30, GLD: 0.10 },
  aggressive:   { QQQ: 0.50, VTI: 0.30, VWO: 0.20 },
};

const ALL_SYMBOLS = ['VTI', 'QQQ', 'BND', 'GLD', 'VEA', 'VWO', 'SPY'] as const;

const CRISES = [
  { event: '2008 Financial Crisis', period: 'Oct 2007 – Mar 2009', start: '2007-10-01', end: '2009-03-31' },
  { event: 'COVID-19 Crash',        period: 'Feb – Apr 2020',       start: '2020-02-01', end: '2020-04-30' },
  { event: '2022 Rate Shock',        period: 'Jan – Dec 2022',       start: '2022-01-01', end: '2022-12-31' },
  { event: '2023 AI Rally',          period: 'Jan – Dec 2023',       start: '2023-01-01', end: '2023-12-31' },
] as const;

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

// ── Alpaca historical bars ────────────────────────────────────────────────────

async function fetchBars(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  let nextToken: string | null = null;

  do {
    const params = new URLSearchParams({
      timeframe: '1Day', start: startDate, end: endDate, limit: '10000', adjustment: 'all',
    });
    if (nextToken) params.set('page_token', nextToken);

    try {
      const res = await fetch(
        `https://data.alpaca.markets/v2/stocks/${symbol}/bars?${params}`,
        {
          headers: {
            'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY!,
            'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY!,
          },
          next: { revalidate: 86400 },
        },
      );
      if (!res.ok) { console.warn(`[backtest] bars ${symbol} ${res.status}`); break; }

      const data = await res.json() as {
        bars?: { t: string; c: number }[];
        next_page_token?: string | null;
      };

      for (const bar of data.bars ?? []) {
        prices.set(bar.t.slice(0, 10), bar.c);
      }
      nextToken = data.next_page_token ?? null;
    } catch (err) {
      console.warn(`[backtest] bars ${symbol}:`, err instanceof Error ? err.message : err);
      break;
    }
  } while (nextToken);

  return prices;
}

// ── Forward-fill prices across all trading days ───────────────────────────────

function forwardFill(raw: Map<string, number>, tradingDays: string[]): Map<string, number> {
  const filled = new Map<string, number>();
  let last = 0;
  for (const d of tradingDays) {
    const p = raw.get(d);
    if (p !== undefined) last = p;
    if (last > 0) filled.set(d, last);
  }
  return filled;
}

// ── Core simulation engine ────────────────────────────────────────────────────

interface SimResult {
  dailyValues:   { date: string; value: number }[];
  monthlyValues: { date: string; value: number }[];
}

function simulate(
  filled: Record<string, Map<string, number>>,
  allocation: Record<string, number>,
  tradingDays: string[],
  initialCapital: number,
): SimResult {
  const symbols = Object.keys(allocation);

  let startIdx = 0;
  while (startIdx < tradingDays.length) {
    if (symbols.every((s) => filled[s]?.has(tradingDays[startIdx]))) break;
    startIdx++;
  }
  if (startIdx >= tradingDays.length) return { dailyValues: [], monthlyValues: [] };

  const shares: Record<string, number> = {};
  const initDate = tradingDays[startIdx];
  for (const sym of symbols) {
    shares[sym] = (allocation[sym] * initialCapital) / filled[sym].get(initDate)!;
  }

  const dailyValues:   { date: string; value: number }[] = [];
  const monthlyValues: { date: string; value: number }[] = [];
  let lastMonth = initDate.slice(0, 7);

  for (let i = startIdx; i < tradingDays.length; i++) {
    const date  = tradingDays[i];
    const month = date.slice(0, 7);
    if (!symbols.every((s) => filled[s]?.has(date))) continue;

    let value = 0;
    for (const sym of symbols) value += shares[sym] * filled[sym].get(date)!;

    if (month !== lastMonth) {
      for (const sym of symbols) {
        shares[sym] = (allocation[sym] * value) / filled[sym].get(date)!;
      }
      lastMonth = month;
    }

    dailyValues.push({ date, value });

    const last = monthlyValues[monthlyValues.length - 1];
    if (!last || last.date.slice(0, 7) !== month) {
      monthlyValues.push({ date, value });
    } else {
      monthlyValues[monthlyValues.length - 1] = { date, value };
    }
  }

  return { dailyValues, monthlyValues };
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (arr.length - 1));
}

interface FullMetrics extends StrategyMetrics {
  best_year:       { year: number; return_pct: number };
  worst_year:      { year: number; return_pct: number };
  monthly_returns: MonthlyReturn[];
}

function computeMetrics(
  sim: SimResult,
  initialCapital: number,
  startDate: string,
  endDate: string,
): FullMetrics {
  const zero: FullMetrics = {
    total_return_pct: 0, annualized_return_pct: 0, sharpe_ratio: 0,
    max_drawdown_pct: 0, win_rate_pct: 0, final_value: initialCapital,
    best_year: { year: 0, return_pct: 0 }, worst_year: { year: 0, return_pct: 0 },
    monthly_returns: [],
  };
  if (sim.monthlyValues.length < 2) return zero;

  const { dailyValues, monthlyValues } = sim;
  const finalValue   = monthlyValues[monthlyValues.length - 1].value;
  const totalReturn  = (finalValue / initialCapital - 1) * 100;
  const years        = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (365.25 * 86_400_000);
  const annualized   = years > 0 ? ((finalValue / initialCapital) ** (1 / years) - 1) * 100 : 0;

  // Max drawdown (daily)
  let peak = dailyValues[0]?.value ?? initialCapital;
  let maxDD = 0;
  for (const { value } of dailyValues) {
    if (value > peak) peak = value;
    const dd = (peak - value) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // Monthly returns
  const monthlyRetDecimals: number[] = [];
  const monthlyReturnsList: MonthlyReturn[] = [];
  let wins = 0;

  for (let i = 1; i < monthlyValues.length; i++) {
    const ret = monthlyValues[i].value / monthlyValues[i - 1].value - 1;
    monthlyRetDecimals.push(ret);
    if (ret > 0) wins++;
    const [y, m] = monthlyValues[i].date.split('-');
    monthlyReturnsList.push({ year: +y, month: +m, return_pct: ret * 100 });
  }

  const meanM  = monthlyRetDecimals.reduce((a, b) => a + b, 0) / (monthlyRetDecimals.length || 1);
  const stdM   = stddev(monthlyRetDecimals);
  const sharpe = stdM > 0 ? (meanM / stdM) * Math.sqrt(12) : 0;
  const winRate = monthlyRetDecimals.length > 0 ? (wins / monthlyRetDecimals.length) * 100 : 0;

  // Annual returns (calendar year, using year-end monthly values)
  const yearEndMap = new Map<number, number>();
  for (const { date, value } of monthlyValues) yearEndMap.set(+date.slice(0, 4), value);
  const sortedYears = Array.from(yearEndMap.keys()).sort();

  let bestYear  = { year: 0, return_pct: -Infinity };
  let worstYear = { year: 0, return_pct:  Infinity };
  let prevVal   = monthlyValues[0].value;

  for (const yr of sortedYears) {
    const endVal = yearEndMap.get(yr)!;
    const ret    = (endVal / prevVal - 1) * 100;
    if (ret > bestYear.return_pct)  bestYear  = { year: yr, return_pct: ret };
    if (ret < worstYear.return_pct) worstYear = { year: yr, return_pct: ret };
    prevVal = endVal;
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
    monthly_returns:       monthlyReturnsList,
  };
}

// ── Crisis performance ────────────────────────────────────────────────────────

function nearestMonthly(
  series: { date: string; value: number }[],
  target: string,
): number | null {
  if (series.length === 0) return null;
  let best = series[0];
  const tMs = new Date(target).getTime();
  for (const pt of series) {
    if (Math.abs(new Date(pt.date).getTime() - tMs) < Math.abs(new Date(best.date).getTime() - tMs)) {
      best = pt;
    }
  }
  return best.value;
}

function computeCrises(
  monthly: { date: string; value: number }[],
  spyMonthly: { date: string; value: number }[],
  startDate: string,
  endDate: string,
): CrisisEvent[] {
  return CRISES
    .filter(({ start }) => start >= startDate && start <= endDate)
    .map(({ event, period, start, end }) => {
      const pStart = nearestMonthly(monthly,    start);
      const pEnd   = nearestMonthly(monthly,    end <= endDate ? end : endDate);
      const sStart = nearestMonthly(spyMonthly, start);
      const sEnd   = nearestMonthly(spyMonthly, end <= endDate ? end : endDate);
      return {
        event,
        period,
        portfolio_return: pStart && pEnd ? (pEnd / pStart - 1) * 100 : 0,
        sp500_return:     sStart && sEnd ? (sEnd / sStart - 1) * 100 : 0,
      };
    });
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: { strategy?: string; start_date?: string; end_date?: string; initial_capital?: number };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const strategy    = (body.strategy as StrategyKey) ?? 'growth';
  const startDate   = body.start_date ?? '2011-01-01';
  const endDate     = body.end_date   ?? new Date().toISOString().slice(0, 10);
  const capital     = typeof body.initial_capital === 'number' ? body.initial_capital : 100_000;

  if (!STRATEGIES[strategy]) {
    return NextResponse.json({ error: 'Unknown strategy' }, { status: 400 });
  }

  const cacheKey = `${strategy}-${startDate}-${endDate}-${capital}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  // Fetch all bars in parallel
  const barResults = await Promise.allSettled(
    ALL_SYMBOLS.map((sym) => fetchBars(sym, startDate, endDate)),
  );

  const rawPrices: Record<string, Map<string, number>> = {};
  for (let i = 0; i < ALL_SYMBOLS.length; i++) {
    rawPrices[ALL_SYMBOLS[i]] = barResults[i].status === 'fulfilled'
      ? (barResults[i] as PromiseFulfilledResult<Map<string, number>>).value
      : new Map();
  }

  if (rawPrices['SPY'].size < 10) {
    return NextResponse.json({ error: 'Insufficient market data' }, { status: 502 });
  }

  const tradingDays = Array.from(rawPrices['SPY'].keys()).sort();
  const filled: Record<string, Map<string, number>> = {};
  for (const sym of ALL_SYMBOLS) filled[sym] = forwardFill(rawPrices[sym], tradingDays);

  // Benchmark (SPY)
  const spySim     = simulate({ SPY: filled['SPY'] }, { SPY: 1.0 }, tradingDays, capital);
  const spyMetrics = computeMetrics(spySim, capital, startDate, endDate);
  const spyMonthMap = new Map(spySim.monthlyValues.map((p) => [p.date.slice(0, 7), p.value]));

  // All 4 strategies for comparison
  const comparison = {} as Record<StrategyKey, StrategyMetrics>;
  for (const strat of Object.keys(STRATEGIES) as StrategyKey[]) {
    const sim = simulate(filled, STRATEGIES[strat], tradingDays, capital);
    const m   = computeMetrics(sim, capital, startDate, endDate);
    comparison[strat] = {
      total_return_pct:      m.total_return_pct,
      annualized_return_pct: m.annualized_return_pct,
      sharpe_ratio:          m.sharpe_ratio,
      max_drawdown_pct:      m.max_drawdown_pct,
      win_rate_pct:          m.win_rate_pct,
      final_value:           m.final_value,
    };
  }

  // Primary strategy full details
  const primarySim  = simulate(filled, STRATEGIES[strategy], tradingDays, capital);
  const primaryM    = computeMetrics(primarySim, capital, startDate, endDate);

  const equityCurve: EquityPoint[] = primarySim.monthlyValues.map(({ date, value }) => ({
    date,
    value:     Math.round(value),
    benchmark: Math.round(spyMonthMap.get(date.slice(0, 7)) ?? capital),
  }));

  const result: BacktestResult = {
    strategy,
    start_date:            startDate,
    end_date:              endDate,
    initial_capital:       capital,
    final_value:           primaryM.final_value,
    total_return_pct:      primaryM.total_return_pct,
    annualized_return_pct: primaryM.annualized_return_pct,
    vs_sp500_pct:          primaryM.annualized_return_pct - spyMetrics.annualized_return_pct,
    sharpe_ratio:          primaryM.sharpe_ratio,
    max_drawdown_pct:      primaryM.max_drawdown_pct,
    win_rate_pct:          primaryM.win_rate_pct,
    best_year:             primaryM.best_year,
    worst_year:            primaryM.worst_year,
    equity_curve:          equityCurve,
    monthly_returns:       primaryM.monthly_returns,
    crisis_performance:    computeCrises(primarySim.monthlyValues, spySim.monthlyValues, startDate, endDate),
    comparison,
  };

  setCache(cacheKey, result);
  return NextResponse.json(result);
}
