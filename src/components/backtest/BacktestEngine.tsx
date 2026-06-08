'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { BacktestResult, StrategyKey } from '@/app/api/backtest/run/route';

// ── Config constants ──────────────────────────────────────────────────────────

const STRATEGY_META: Record<StrategyKey, { name: string; alloc: string; tag: string }> = {
  conservative: { name: 'Conservative', alloc: 'BND 40 · VTI 30 · VEA 20 · GLD 10',  tag: '6–12% target' },
  balanced:     { name: 'Balanced',     alloc: 'VTI 50 · BND 20 · QQQ 15 · VEA 15',  tag: '12–20% target' },
  growth:       { name: 'Growth',       alloc: 'VTI 60 · QQQ 30 · GLD 10',            tag: '20–35% target' },
  aggressive:   { name: 'Aggressive',   alloc: 'QQQ 50 · VTI 30 · VWO 20',            tag: '35%+ target' },
};

const PERIODS = [
  { key: '5Y',         label: '5 Years'   },
  { key: '10Y',        label: '10 Years'  },
  { key: '15Y',        label: '15 Years'  },
  { key: 'since2008',  label: 'Since 2008' },
] as const;

const CAPITALS = [10_000, 50_000, 100_000, 500_000];

const LOAD_MSGS = [
  'Fetching 15 years of market data...',
  'Running portfolio simulation...',
  'Computing risk metrics...',
  'Calculating Sharpe ratio...',
  'Building equity curve...',
  'Comparing strategies...',
];

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodStart(period: string): string {
  const now = new Date();
  switch (period) {
    case '5Y':        return new Date(now.getFullYear() - 5,  now.getMonth(), now.getDate()).toISOString().slice(0, 10);
    case '10Y':       return new Date(now.getFullYear() - 10, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
    case '15Y':       return new Date(now.getFullYear() - 15, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
    case 'since2008': return '2008-01-02';
    default:          return '2016-01-01';
  }
}

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number, decimals = 1): string {
  return (n >= 0 ? '+' : '') + n.toFixed(decimals) + '%';
}

function cellStyle(ret: number | undefined): string {
  if (ret === undefined) return 'bg-[#F8F9FA] text-[#4A5568]/30';
  if (ret > 5)  return 'bg-[#16A34A] text-white';
  if (ret > 2)  return 'bg-[#16A34A]/65 text-white';
  if (ret > 0)  return 'bg-[#16A34A]/30 text-[#0A1628]';
  if (ret > -2) return 'bg-[#C41E3A]/30 text-[#0A1628]';
  if (ret > -5) return 'bg-[#C41E3A]/65 text-white';
  return 'bg-[#C41E3A] text-white';
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const tavola = payload.find((p: { dataKey: string }) => p.dataKey === 'value')?.value as number | undefined;
  const spy    = payload.find((p: { dataKey: string }) => p.dataKey === 'benchmark')?.value as number | undefined;
  const alpha  = tavola && spy && spy > 0 ? ((tavola - spy) / spy * 100).toFixed(1) : null;
  const [y, m] = String(label).split('-');
  const prettyDate = m ? `${MONTHS_SHORT[+m - 1]} ${y}` : label;
  return (
    <div className="border border-[#E2E8F0] bg-white p-3 text-[12px]">
      <p className="mb-1 text-[#4A5568]">{prettyDate}</p>
      {tavola !== undefined && <p className="font-medium text-[#B8960C]">Tavola {fmt$(tavola)}</p>}
      {spy    !== undefined && <p className="text-[#4A5568]">S&P 500 {fmt$(spy)}</p>}
      {alpha !== null && (
        <p className={`mt-1 text-[11px] ${+alpha >= 0 ? 'text-[#16A34A]' : 'text-[#C41E3A]'}`}>
          Alpha {+alpha >= 0 ? '+' : ''}{alpha}%
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  isPublic?: boolean;
}

export function BacktestEngine({ isPublic = false }: Props) {
  const [strategy, setStrategy] = useState<StrategyKey>('growth');
  const [period,   setPeriod]   = useState<string>('10Y');
  const [capital,  setCapital]  = useState(100_000);
  const [running,  setRunning]  = useState(false);
  const [result,   setResult]   = useState<BacktestResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [loadMsg,  setLoadMsg]  = useState('');

  useEffect(() => {
    if (!running) return;
    let i = 0;
    setLoadMsg(LOAD_MSGS[0]);
    const id = setInterval(() => {
      i = (i + 1) % LOAD_MSGS.length;
      setLoadMsg(LOAD_MSGS[i]);
    }, 1_400);
    return () => clearInterval(id);
  }, [running]);

  async function runBacktest() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy,
          start_date:      periodStart(period),
          end_date:        new Date().toISOString().slice(0, 10),
          initial_capital: capital,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Backtest failed'); return; }
      setResult(data as BacktestResult);
    } catch {
      setError('Network error — please try again');
    } finally {
      setRunning(false);
    }
  }

  // ── Monthly heatmap data ────────────────────────────────────────────────────
  const returnMap = new Map<string, number>();
  if (result) {
    for (const m of result.monthly_returns) returnMap.set(`${m.year}-${m.month}`, m.return_pct);
  }
  const heatmapYears = result
    ? Array.from(new Set(result.monthly_returns.map((m) => m.year))).sort().reverse()
    : [];

  // ── Chart data (every 3rd monthly point to reduce density) ─────────────────
  const chartData = result?.equity_curve.filter((_, i) => i % 3 === 0 || i === result.equity_curve.length - 1) ?? [];

  return (
    <div className="min-h-screen bg-white">

      {/* ── Config panel ───────────────────────────────────────────────────── */}
      <div className="border-b border-[#E2E8F0] bg-[#F8F9FA] px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <span className="text-[10px] tracking-[0.3em] uppercase text-[#B8960C]">
              Backtesting Engine
            </span>
            <h1 className="mt-2 font-serif text-[28px] font-light text-[#0A1628] leading-none">
              Historical Performance Simulation
            </h1>
            <p className="mt-2 text-[13px] text-[#4A5568]">
              Run each strategy against 15 years of real market data with monthly rebalancing.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">

            {/* Strategy */}
            <div>
              <p className="mb-3 text-[10px] tracking-[0.2em] uppercase text-[#4A5568]">Strategy</p>
              <div className="space-y-2">
                {(Object.keys(STRATEGY_META) as StrategyKey[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStrategy(s)}
                    className={`w-full border p-3 text-left transition-colors ${
                      strategy === s
                        ? 'border-[#B8960C] bg-white'
                        : 'border-[#E2E8F0] bg-white hover:border-[#B8960C]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-[#0A1628]">
                        {STRATEGY_META[s].name}
                      </span>
                      <span className="text-[10px] tracking-[0.08em] text-[#B8960C]">
                        {STRATEGY_META[s].tag}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-[#4A5568]">{STRATEGY_META[s].alloc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Period */}
            <div>
              <p className="mb-3 text-[10px] tracking-[0.2em] uppercase text-[#4A5568]">Time Period</p>
              <div className="grid grid-cols-2 gap-2">
                {PERIODS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setPeriod(key)}
                    className={`border py-3 text-[13px] transition-colors ${
                      period === key
                        ? 'border-[#B8960C] bg-white text-[#0A1628] font-medium'
                        : 'border-[#E2E8F0] bg-white text-[#4A5568] hover:border-[#B8960C]/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Capital */}
              <p className="mb-3 mt-6 text-[10px] tracking-[0.2em] uppercase text-[#4A5568]">
                Initial Capital
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CAPITALS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCapital(c)}
                    className={`border py-3 text-[13px] transition-colors ${
                      capital === c
                        ? 'border-[#B8960C] bg-white text-[#0A1628] font-medium'
                        : 'border-[#E2E8F0] bg-white text-[#4A5568] hover:border-[#B8960C]/40'
                    }`}
                  >
                    {fmt$(c)}
                  </button>
                ))}
              </div>
            </div>

            {/* Run */}
            <div className="flex flex-col justify-between">
              <div className="border border-[#E2E8F0] bg-white p-5">
                <p className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568] mb-3">
                  Simulation Parameters
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#4A5568]">Strategy</span>
                    <span className="text-[#0A1628]">{STRATEGY_META[strategy].name}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#4A5568]">Period</span>
                    <span className="text-[#0A1628]">
                      {PERIODS.find((p) => p.key === period)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#4A5568]">Capital</span>
                    <span className="text-[#0A1628]">{fmt$(capital)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#4A5568]">Rebalancing</span>
                    <span className="text-[#0A1628]">Monthly</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#4A5568]">Benchmark</span>
                    <span className="text-[#0A1628]">S&P 500 (SPY)</span>
                  </div>
                </div>
              </div>

              <button
                onClick={runBacktest}
                disabled={running}
                className="mt-4 w-full bg-[#0A1628] py-4 text-[13px] tracking-[0.15em] uppercase text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {running ? 'Running...' : 'Run Backtest'}
              </button>

              {isPublic && !result && !running && (
                <a
                  href="/signup"
                  className="mt-3 block w-full border border-[#B8960C] py-3 text-center text-[12px] tracking-[0.12em] uppercase text-[#B8960C] hover:bg-[#B8960C]/5 transition-colors"
                >
                  Open Live Account
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {running && (
        <div className="px-8 py-20 text-center">
          <div className="mx-auto mb-4 h-px w-16 bg-[#B8960C] animate-pulse" />
          <p className="text-[13px] text-[#4A5568]">{loadMsg}</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && !running && (
        <div className="px-8 py-10">
          <div className="max-w-6xl mx-auto border border-[#C41E3A]/30 bg-[#C41E3A]/5 p-4">
            <p className="text-[13px] text-[#C41E3A]">{error}</p>
          </div>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {result && !running && (
        <div className="px-8 py-8">
          <div className="max-w-6xl mx-auto space-y-8">

            {/* Section 1 — Key metrics ────────────────────────────────────── */}
            <div>
              <div className="mb-1 flex items-baseline gap-3">
                <span className="font-serif text-[11px] tracking-[0.3em] uppercase text-[#B8960C]">
                  {STRATEGY_META[result.strategy].name} Strategy
                </span>
                <span className="text-[11px] text-[#4A5568]">
                  {result.start_date} – {result.end_date}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                {[
                  {
                    label: 'Final Value',
                    value: fmt$(result.final_value),
                    sub: `from ${fmt$(result.initial_capital)}`,
                    color: 'text-[#0A1628]',
                  },
                  {
                    label: 'Total Return',
                    value: fmtPct(result.total_return_pct),
                    color: result.total_return_pct >= 0 ? 'text-[#16A34A]' : 'text-[#C41E3A]',
                  },
                  {
                    label: 'Annualized',
                    value: fmtPct(result.annualized_return_pct),
                    color: result.annualized_return_pct >= 0 ? 'text-[#16A34A]' : 'text-[#C41E3A]',
                  },
                  {
                    label: 'vs S&P 500',
                    value: fmtPct(result.vs_sp500_pct),
                    sub: 'annual alpha',
                    color: result.vs_sp500_pct >= 0 ? 'text-[#16A34A]' : 'text-[#C41E3A]',
                  },
                  {
                    label: 'Sharpe Ratio',
                    value: result.sharpe_ratio.toFixed(2),
                    color: result.sharpe_ratio >= 1 ? 'text-[#16A34A]' : result.sharpe_ratio >= 0.5 ? 'text-amber-600' : 'text-[#C41E3A]',
                  },
                  {
                    label: 'Max Drawdown',
                    value: fmtPct(-result.max_drawdown_pct),
                    color: 'text-[#C41E3A]',
                  },
                  {
                    label: 'Win Rate',
                    value: result.win_rate_pct.toFixed(1) + '%',
                    sub: 'profitable months',
                    color: result.win_rate_pct >= 55 ? 'text-[#16A34A]' : 'text-[#4A5568]',
                  },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="border border-[#E2E8F0] p-4">
                    <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568] mb-1">{label}</p>
                    <p className={`font-serif text-[22px] font-light leading-none ${color}`}>{value}</p>
                    {sub && <p className="mt-1 text-[10px] text-[#4A5568]">{sub}</p>}
                  </div>
                ))}
              </div>

              {/* Best / worst year inline */}
              <div className="mt-3 flex gap-4 text-[12px]">
                {result.best_year.year > 0 && (
                  <span className="text-[#4A5568]">
                    Best year: <span className="text-[#16A34A]">{result.best_year.year} ({fmtPct(result.best_year.return_pct)})</span>
                  </span>
                )}
                {result.worst_year.year > 0 && (
                  <span className="text-[#4A5568]">
                    Worst year: <span className="text-[#C41E3A]">{result.worst_year.year} ({fmtPct(result.worst_year.return_pct)})</span>
                  </span>
                )}
              </div>
            </div>

            {/* Section 2 — Equity curve ───────────────────────────────────── */}
            <div className="border border-[#E2E8F0] p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[11px] tracking-[0.2em] uppercase text-[#4A5568]">
                  Portfolio Growth vs S&P 500
                </p>
                <div className="flex items-center gap-5 text-[11px]">
                  <span className="flex items-center gap-1.5 text-[#4A5568]">
                    <span className="h-px w-6 bg-[#B8960C]" /> Tavola
                  </span>
                  <span className="flex items-center gap-1.5 text-[#4A5568]">
                    <span className="h-px w-6 bg-[#9CA3AF] [border-style:dashed]" /> S&P 500
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="g-tavola" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#B8960C" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#B8960C" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-spy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#9CA3AF" stopOpacity={0.10} />
                      <stop offset="95%" stopColor="#9CA3AF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#4A5568' }}
                    tickFormatter={(v: string) => v.slice(0, 4)}
                    interval={11}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#4A5568' }}
                    tickFormatter={(v: number) =>
                      v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1_000).toFixed(0)}k`
                    }
                    width={56}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#B8960C"
                    strokeWidth={2}
                    fill="url(#g-tavola)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="benchmark"
                    stroke="#9CA3AF"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    fill="url(#g-spy)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Section 3 — Crisis performance ────────────────────────────── */}
            {result.crisis_performance.length > 0 && (
              <div className="border border-[#E2E8F0]">
                <div className="border-b border-[#E2E8F0] px-6 py-4">
                  <p className="text-[11px] tracking-[0.2em] uppercase text-[#4A5568]">
                    Crisis Period Performance
                  </p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      {['Event', 'Period', 'Tavola', 'S&P 500', 'Outperformance'].map((h) => (
                        <th
                          key={h}
                          className="px-6 py-3 text-left text-[10px] tracking-[0.15em] uppercase text-[#4A5568]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.crisis_performance.map((c) => {
                      const outperf = c.portfolio_return - c.sp500_return;
                      return (
                        <tr key={c.event} className="border-b border-[#E2E8F0] last:border-0">
                          <td className="px-6 py-4 text-[13px] font-medium text-[#0A1628]">{c.event}</td>
                          <td className="px-6 py-4 text-[12px] text-[#4A5568]">{c.period}</td>
                          <td className={`px-6 py-4 font-serif text-[14px] ${c.portfolio_return >= 0 ? 'text-[#16A34A]' : 'text-[#C41E3A]'}`}>
                            {fmtPct(c.portfolio_return)}
                          </td>
                          <td className={`px-6 py-4 font-serif text-[14px] ${c.sp500_return >= 0 ? 'text-[#16A34A]' : 'text-[#C41E3A]'}`}>
                            {fmtPct(c.sp500_return)}
                          </td>
                          <td className={`px-6 py-4 font-serif text-[14px] font-medium ${outperf >= 0 ? 'text-[#16A34A]' : 'text-[#C41E3A]'}`}>
                            {fmtPct(outperf)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Section 4 — Monthly returns heatmap ───────────────────────── */}
            {heatmapYears.length > 0 && (
              <div className="border border-[#E2E8F0] overflow-x-auto">
                <div className="border-b border-[#E2E8F0] px-6 py-4">
                  <p className="text-[11px] tracking-[0.2em] uppercase text-[#4A5568]">
                    Monthly Returns Heatmap
                  </p>
                </div>
                <div className="px-6 py-4">
                  <div className="min-w-[640px]">
                    {/* Month headers */}
                    <div className="grid grid-cols-13 mb-1" style={{ gridTemplateColumns: '48px repeat(12, 1fr)' }}>
                      <div />
                      {MONTHS_SHORT.map((m) => (
                        <div key={m} className="text-center text-[9px] tracking-[0.1em] uppercase text-[#4A5568]">
                          {m}
                        </div>
                      ))}
                    </div>
                    {heatmapYears.map((year) => (
                      <div
                        key={year}
                        className="grid mb-0.5"
                        style={{ gridTemplateColumns: '48px repeat(12, 1fr)' }}
                      >
                        <div className="flex items-center text-[10px] text-[#4A5568]">{year}</div>
                        {Array.from({ length: 12 }, (_, i) => {
                          const ret = returnMap.get(`${year}-${i + 1}`);
                          return (
                            <div
                              key={i}
                              title={ret !== undefined ? `${MONTHS_SHORT[i]} ${year}: ${ret.toFixed(2)}%` : undefined}
                              className={`mx-0.5 py-1.5 text-center text-[9px] ${cellStyle(ret)}`}
                            >
                              {ret !== undefined ? (ret >= 0 ? '+' : '') + ret.toFixed(1) : ''}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Section 5 — Strategy comparison ───────────────────────────── */}
            <div className="border border-[#E2E8F0]">
              <div className="border-b border-[#E2E8F0] px-6 py-4">
                <p className="text-[11px] tracking-[0.2em] uppercase text-[#4A5568]">
                  Strategy Comparison
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      {['Strategy', 'Final Value', 'Annualized', 'Total Return', 'Sharpe', 'Max DD', 'Win Rate'].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left text-[10px] tracking-[0.12em] uppercase text-[#4A5568]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(STRATEGY_META) as StrategyKey[]).map((strat) => {
                      const m = result.comparison[strat];
                      const active = strat === result.strategy;
                      return (
                        <tr
                          key={strat}
                          className={`border-b border-[#E2E8F0] last:border-0 ${active ? 'bg-[#B8960C]/5' : ''}`}
                        >
                          <td className="px-5 py-4">
                            <span className={`text-[13px] ${active ? 'font-medium text-[#B8960C]' : 'text-[#0A1628]'}`}>
                              {STRATEGY_META[strat].name}
                            </span>
                            {active && (
                              <span className="ml-2 text-[9px] tracking-[0.12em] uppercase text-[#B8960C]/70">
                                selected
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 font-serif text-[14px] text-[#0A1628]">{fmt$(m.final_value)}</td>
                          <td className={`px-5 py-4 font-serif text-[14px] ${m.annualized_return_pct >= 0 ? 'text-[#16A34A]' : 'text-[#C41E3A]'}`}>
                            {fmtPct(m.annualized_return_pct)}
                          </td>
                          <td className={`px-5 py-4 font-serif text-[14px] ${m.total_return_pct >= 0 ? 'text-[#16A34A]' : 'text-[#C41E3A]'}`}>
                            {fmtPct(m.total_return_pct)}
                          </td>
                          <td className="px-5 py-4 text-[13px] text-[#0A1628]">{m.sharpe_ratio.toFixed(2)}</td>
                          <td className="px-5 py-4 text-[13px] text-[#C41E3A]">{fmtPct(-m.max_drawdown_pct)}</td>
                          <td className="px-5 py-4 text-[13px] text-[#0A1628]">{m.win_rate_pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Public CTA ───────────────────────────────────────────────── */}
            {isPublic && (
              <div className="border-2 border-[#B8960C] p-8 text-center">
                <p className="font-serif text-[24px] font-light text-[#0A1628] mb-2">
                  Invest with proven results
                </p>
                <p className="text-[13px] text-[#4A5568] mb-6 max-w-md mx-auto">
                  Open a Tavola account and let our AI run these strategies with your capital.
                  No minimum deposit required.
                </p>
                <a
                  href="/signup"
                  className="inline-block bg-[#0A1628] px-10 py-3.5 text-[12px] tracking-[0.2em] uppercase text-white hover:opacity-80 transition-opacity"
                >
                  Open an Account
                </a>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
