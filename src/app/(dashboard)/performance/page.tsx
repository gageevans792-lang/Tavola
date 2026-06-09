'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TopBar } from '@/components/layout/TopBar';
import type { PerformanceData, EquityPoint } from '@/app/api/performance/route';

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS = ['1W', '1M', '3M', '6M', '1Y', 'ALL'] as const;
type Period = typeof PERIODS[number];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtPct(n: number, sign = true): string {
  const s = sign && n >= 0 ? '+' : '';
  return `${s}${n.toFixed(2)}%`;
}

function fmtUSD(n: number): string {
  const abs = Math.abs(n);
  const prefix = n < 0 ? '-$' : '$';
  return prefix + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtYAxis(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${(v / 1_000).toFixed(0)}k`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMonthTick(iso: string, idx: number, total: number): string {
  if (total <= 30) return idx % 5 === 0 ? fmtDate(iso) : '';
  if (total <= 90) return idx % 15 === 0 ? fmtDate(iso) : '';
  return idx % 30 === 0 ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '';
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function posColor(v: number) {
  return v >= 0 ? '#166534' : '#991b1b';
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

interface TooltipItem { name: string; value: number; color: string }

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const portfolio  = payload.find((p) => p.name === 'Portfolio');
  const benchmark  = payload.find((p) => p.name === 'S&P 500');
  const alpha      = portfolio && benchmark ? portfolio.value - benchmark.value : null;

  return (
    <div style={{ background: '#0A1628', border: '1px solid #1E3A5F', padding: '10px 14px', fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#fff' }}>
      <p style={{ color: '#B8960C', marginBottom: 6, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label ? fmtDate(label) : ''}
      </p>
      {payload.map((item) => (
        <p key={item.name} style={{ margin: '2px 0', color: item.color }}>
          <span style={{ color: '#94A3B8', marginRight: 8 }}>{item.name}</span>
          {fmtUSD(item.value)}
        </p>
      ))}
      {alpha !== null && (
        <p style={{ margin: '4px 0 0', borderTop: '1px solid #1E3A5F', paddingTop: 4, color: alpha >= 0 ? '#4ade80' : '#f87171' }}>
          <span style={{ color: '#94A3B8', marginRight: 8 }}>Alpha</span>
          {fmtUSD(alpha)}
        </p>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ h = 'h-6', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} bg-[#E2E8F0] animate-pulse`} />;
}

// ── Metric Card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label:     string;
  value:     string;
  sub?:      string;
  color?:    string;
  loading:   boolean;
}

function MetricCard({ label, value, sub, color, loading }: MetricCardProps) {
  return (
    <div className="bg-white border border-[#E2E8F0] px-4 sm:px-6 py-4 sm:py-5">
      <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568] mb-2 sm:mb-3">{label}</p>
      {loading
        ? <Skeleton h="h-7 sm:h-8" w="w-2/3" />
        : <p className="font-mono text-xl sm:text-[22px] tabular-nums" style={{ color: color ?? '#0A1628' }}>{value}</p>
      }
      {sub && !loading && (
        <p className="text-[11px] text-[#4A5568] mt-1">{sub}</p>
      )}
    </div>
  );
}

// ── Monthly Return Cell ───────────────────────────────────────────────────────

function MonthCell({ value }: { value?: number }) {
  if (value === undefined) {
    return <div className="h-9 bg-[#F8F9FA] border border-[#E2E8F0]" />;
  }
  const positive = value >= 0;
  const intensity = Math.min(Math.abs(value) / 8, 1);
  const bg = positive
    ? `rgba(22, 101, 52, ${0.08 + intensity * 0.35})`
    : `rgba(153, 27, 27, ${0.08 + intensity * 0.35})`;
  return (
    <div
      className="h-9 flex items-center justify-center border border-[#E2E8F0]"
      style={{ background: bg }}
    >
      <span className="font-mono text-[11px] tabular-nums" style={{ color: positive ? '#166534' : '#991b1b' }}>
        {value >= 0 ? '+' : ''}{value.toFixed(1)}%
      </span>
    </div>
  );
}

// ── AI Accuracy Bar ───────────────────────────────────────────────────────────

function AccuracyBar({ label, accurate, total }: { label: string; accurate: number; total: number }) {
  const pct = total > 0 ? (accurate / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-[#4A5568]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-[#0A1628] tabular-nums">{accurate}/{total}</span>
          <span className="font-mono text-[12px] tabular-nums" style={{ color: posColor(pct - 50), minWidth: 40, textAlign: 'right' }}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-[#E2E8F0] w-full">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, background: pct >= 60 ? '#166534' : pct >= 45 ? '#B8960C' : '#991b1b' }}
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const [period, setPeriod] = useState<Period>('3M');
  const [data, setData]     = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/performance?period=${p}`);
      if (!res.ok) throw new Error('Failed to load performance data');
      const json: PerformanceData = await res.json();
      setData(json);
    } catch {
      setError('Performance data temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  // Monthly returns grid: last 2 calendar years
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear];

  function getMonthReturn(year: number, month: number): number | undefined {
    return data?.monthly_returns.find((r) => r.year === year && r.month === month)?.return_pct;
  }

  const d = data;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Performance" />

      <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">

          {/* ── Error ──────────────────────────────────────────────────────────── */}
          {error && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C41E3A]">{error}</div>
          )}

          {/* ── Empty state when no equity history ──────────────────────────────── */}
          {!loading && d && d.equity_curve.length === 0 && (
            <div className="bg-white border border-[#E2E8F0] px-4 sm:px-8 py-16 text-center">
              <p className="text-[10px] tracking-[0.25em] uppercase text-[#B8960C] mb-4">No Data Yet</p>
              <h3 className="font-serif text-[24px] sm:text-[28px] font-light text-[#0A1628] mb-3">
                Performance tracking begins with your first trade.
              </h3>
              <p className="text-[14px] text-[#4A5568] max-w-sm mx-auto mb-8 leading-relaxed">
                Once you make your first trade, Tavola will track your portfolio performance over time.
              </p>
              <a
                href="/dashboard"
                className="inline-block bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:bg-[#162035] transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          )}

          {/* ── 1. PERFORMANCE HEADER ────────────────────────────────────────── */}
          <section className="bg-white border border-[#E2E8F0] px-4 sm:px-8 py-6 sm:py-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">

              {/* Return display */}
              <div>
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#4A5568] mb-2">
                  Portfolio Return — {period}
                </p>
                {loading ? (
                  <Skeleton h="h-14" w="w-48" />
                ) : (
                  <p
                    className="font-serif tabular-nums leading-none"
                    style={{
                      fontSize:    'clamp(36px, 10vw, 64px)',
                      fontWeight:  300,
                      color:       d ? (d.portfolio_return >= 0 ? '#B8960C' : '#991b1b') : '#B8960C',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {d ? fmtPct(d.portfolio_return) : '--'}
                  </p>
                )}

                {/* vs S&P */}
                {!loading && d && (
                  <div className="mt-3 flex items-center gap-4">
                    <div>
                      <p className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]">S&amp;P 500</p>
                      <p className="font-mono text-[15px] tabular-nums" style={{ color: posColor(d.benchmark_return) }}>
                        {fmtPct(d.benchmark_return)}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-[#E2E8F0]" />
                    <div>
                      <p className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]">Alpha</p>
                      <p className="font-mono text-[15px] tabular-nums" style={{ color: posColor(d.alpha) }}>
                        {fmtPct(d.alpha)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Period pills */}
              <div className="flex flex-wrap items-center gap-1 self-start sm:self-auto">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={[
                      'px-3 sm:px-4 py-1.5 text-[11px] tracking-[0.1em] uppercase transition-colors',
                      period === p
                        ? 'bg-[#0A1628] text-white'
                        : 'bg-white border border-[#E2E8F0] text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628]',
                    ].join(' ')}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── 2. KEY METRICS ROW ───────────────────────────────────────────── */}
          <section className="grid grid-cols-2 gap-2 sm:gap-px sm:bg-[#E2E8F0] lg:grid-cols-4">
            <MetricCard
              label="Total Return"
              value={d ? fmtUSD(d.total_return_value) : '--'}
              sub={d ? fmtPct(d.total_return_pct) + ' all-time' : undefined}
              color={d ? posColor(d.total_return_value) : undefined}
              loading={loading}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={d ? d.sharpe_ratio.toFixed(2) : '--'}
              sub={d ? (d.sharpe_ratio >= 1 ? 'Above benchmark quality' : d.sharpe_ratio >= 0 ? 'Acceptable range' : 'Below risk-free rate') : undefined}
              color={d ? (d.sharpe_ratio >= 1 ? '#166534' : d.sharpe_ratio >= 0 ? '#B8960C' : '#991b1b') : undefined}
              loading={loading}
            />
            <MetricCard
              label="Max Drawdown"
              value={d ? fmtPct(d.max_drawdown, false) : '--'}
              sub={d ? 'Worst peak-to-trough loss' : undefined}
              color={d ? (d.max_drawdown > -10 ? '#166534' : d.max_drawdown > -20 ? '#B8960C' : '#991b1b') : undefined}
              loading={loading}
            />
            <MetricCard
              label="Win Rate"
              value={d ? `${d.win_rate.toFixed(1)}%` : '--'}
              sub={d ? `${d.trade_stats.total_trades} total trades` : undefined}
              color={d ? (d.win_rate >= 60 ? '#166534' : d.win_rate >= 45 ? '#B8960C' : '#991b1b') : undefined}
              loading={loading}
            />
          </section>

          {/* ── 3. EQUITY CURVE CHART ────────────────────────────────────────── */}
          <section className="bg-white border border-[#E2E8F0] min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
              <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568]">Equity Curve</p>
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-px w-6 bg-[#B8960C]" />
                  <span className="text-[10px] uppercase tracking-[0.1em] text-[#4A5568]">Portfolio</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-px w-6" style={{ borderTop: '1px dashed #4A5568' }} />
                  <span className="text-[10px] uppercase tracking-[0.1em] text-[#4A5568]">S&amp;P 500</span>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="px-2 py-4 h-[200px] sm:h-[280px]">
                <div className="w-full h-full bg-[#F8F9FA] animate-pulse" />
              </div>
            ) : !d?.equity_curve.length ? (
              <div className="flex items-center justify-center h-[200px] sm:h-[280px]">
                <p className="text-sm text-[#4A5568]">No chart data available</p>
              </div>
            ) : (
              <div className="h-[200px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={d.equity_curve}
                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="perfPortfolioFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#B8960C" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#B8960C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="1 4" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v, i) => fmtMonthTick(v, i, d.equity_curve.length)}
                      tick={{ fontSize: 10, fill: '#4A5568' }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                    />
                    <YAxis
                      orientation="right"
                      tickFormatter={fmtYAxis}
                      tick={{ fontSize: 10, fill: '#4A5568' }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                    />
                    <ReferenceLine y={d.equity_curve[0]?.portfolio} stroke="#E2E8F0" strokeDasharray="2 4" />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="portfolio"
                      name="Portfolio"
                      stroke="#B8960C"
                      strokeWidth={1.5}
                      fill="url(#perfPortfolioFill)"
                      dot={false}
                      activeDot={{ r: 3, fill: '#B8960C', stroke: 'none' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="benchmark"
                      name="S&P 500"
                      stroke="#4A5568"
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      fill="none"
                      dot={false}
                      activeDot={{ r: 2, fill: '#4A5568', stroke: 'none' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* ── 4. MONTHLY RETURNS TABLE ─────────────────────────────────────── */}
          <section className="bg-white border border-[#E2E8F0]">
            <div className="border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
              <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568]">Monthly Returns</p>
            </div>
            <div className="overflow-x-auto p-4">
              <table className="w-full text-xs sm:text-sm" style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    <th className="pb-2 pr-2 text-left">
                      <span className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">Month</span>
                    </th>
                    {years.map((y) => (
                      <th key={y} colSpan={1} className="pb-2 px-1 text-center">
                        <span className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">{y}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((label, mi) => {
                    const month = mi + 1;
                    const isFuture = (y: number) => {
                      const now = new Date();
                      return y > now.getFullYear() || (y === now.getFullYear() && month > now.getMonth() + 1);
                    };
                    return (
                      <tr key={month}>
                        <td className="pr-2 pb-1">
                          <span className="text-[11px] text-[#4A5568] tabular-nums">{label}</span>
                        </td>
                        {years.map((y) => (
                          <td key={y} className="pb-1 px-1">
                            {loading ? (
                              <div className="h-9 bg-[#E2E8F0] animate-pulse" />
                            ) : isFuture(y) ? (
                              <div className="h-9 bg-[#F8F9FA] border border-[#E2E8F0]" />
                            ) : (
                              <MonthCell value={getMonthReturn(y, month)} />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Annual totals */}
              {!loading && d && (
                <div className="mt-2 flex gap-1 pl-[calc(theme(spacing.2)+1ch+theme(spacing.2))]">
                  {/* spacer for month column */}
                  <div style={{ width: 'calc(50% - 4px)' }} />
                  {years.map((y) => {
                    const yearReturns = d.monthly_returns.filter((r) => r.year === y);
                    const annualReturn = yearReturns.reduce((acc, r) => acc * (1 + r.return_pct / 100), 1) - 1;
                    const pct = annualReturn * 100;
                    return (
                      <div
                        key={y}
                        className="flex-1 border border-[#E2E8F0] h-9 flex items-center justify-center"
                        style={{ background: pct >= 0 ? 'rgba(22,101,52,0.12)' : 'rgba(153,27,27,0.12)' }}
                      >
                        <span className="font-mono text-[11px] font-medium tabular-nums" style={{ color: posColor(pct) }}>
                          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ── 5. TRADE PERFORMANCE ────────────────────────────────────────── */}
          <section className="grid gap-2 sm:gap-px sm:bg-[#E2E8F0] lg:grid-cols-2">

            {/* Best / Worst */}
            <div className="bg-white px-4 sm:px-8 py-6 space-y-6">
              <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568]">Trade Highlights</p>

              {loading ? (
                <div className="space-y-4">
                  <Skeleton h="h-16" />
                  <Skeleton h="h-16" />
                </div>
              ) : (
                <>
                  {/* Best trade */}
                  <div className="border-l-2 border-[#166534] pl-4">
                    <p className="text-[10px] tracking-[0.12em] uppercase text-[#166534] mb-1">Best Position</p>
                    {d?.trade_stats.best_trade ? (
                      <>
                        <p className="font-mono text-[20px] text-[#0A1628] tabular-nums">
                          {d.trade_stats.best_trade.ticker}
                        </p>
                        <p className="font-mono text-[15px] text-[#166534] tabular-nums mt-0.5">
                          {fmtPct(d.trade_stats.best_trade.return_pct)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-[#4A5568]">No positions yet</p>
                    )}
                  </div>

                  {/* Worst trade */}
                  <div className="border-l-2 border-[#991b1b] pl-4">
                    <p className="text-[10px] tracking-[0.12em] uppercase text-[#991b1b] mb-1">Worst Position</p>
                    {d?.trade_stats.worst_trade ? (
                      <>
                        <p className="font-mono text-[20px] text-[#0A1628] tabular-nums">
                          {d.trade_stats.worst_trade.ticker}
                        </p>
                        <p className="font-mono text-[15px] text-[#991b1b] tabular-nums mt-0.5">
                          {fmtPct(d.trade_stats.worst_trade.return_pct)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-[#4A5568]">No positions yet</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="bg-white px-4 sm:px-8 py-6">
              <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568] mb-6">Trade Statistics</p>
              {loading ? (
                <div className="space-y-4">
                  {[1,2,3].map((i) => <Skeleton key={i} h="h-8" />)}
                </div>
              ) : (
                <div className="space-y-0 divide-y divide-[#E2E8F0]">
                  {[
                    { label: 'Total Trades Executed', value: (d?.trade_stats.total_trades ?? 0).toString() },
                    { label: 'Avg. Holding Period', value: d?.trade_stats.avg_holding_days ? `${d.trade_stats.avg_holding_days}d` : '—' },
                    { label: 'Win Rate', value: d ? `${d.win_rate.toFixed(1)}%` : '—', color: d ? posColor(d.win_rate - 50) : undefined },
                    { label: 'Sharpe Ratio (Period)', value: d ? d.sharpe_ratio.toFixed(2) : '—', color: d ? (d.sharpe_ratio >= 1 ? '#166534' : d.sharpe_ratio >= 0 ? '#B8960C' : '#991b1b') : undefined },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-3.5">
                      <span className="text-xs sm:text-[13px] text-[#4A5568]">{label}</span>
                      <span className="font-mono text-[14px] tabular-nums" style={{ color: color ?? '#0A1628' }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── 6. AI PERFORMANCE ATTRIBUTION ───────────────────────────────── */}
          <section className="bg-white border border-[#E2E8F0]">
            {/* Header */}
            <div className="border-b border-[#E2E8F0] px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568]">AI Performance Attribution</p>
                <p className="text-[12px] text-[#4A5568] mt-0.5">Accountability and transparency for every AI recommendation</p>
              </div>
              {!loading && d && (
                <div className="sm:text-right">
                  <p className="font-mono text-xl sm:text-[22px] tabular-nums" style={{ color: posColor(d.ai_attribution.ai_accuracy - 50) }}>
                    {d.ai_attribution.ai_accuracy.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[#4A5568] mt-0.5">Overall AI Accuracy</p>
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:gap-px sm:bg-[#E2E8F0] lg:grid-cols-2">

              {/* Accuracy stats */}
              <div className="bg-white px-4 sm:px-8 py-6">
                <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568] mb-5">Accuracy by Confidence Level</p>
                {loading ? (
                  <div className="space-y-5">
                    <Skeleton h="h-8" />
                    <Skeleton h="h-8" />
                    <Skeleton h="h-8" />
                  </div>
                ) : d ? (
                  <div className="space-y-5">
                    <AccuracyBar
                      label="Overall (all AI trades)"
                      accurate={d.ai_attribution.profitable_ai_trades}
                      total={d.ai_attribution.total_ai_trades}
                    />
                    <AccuracyBar
                      label="High confidence (90%+)"
                      accurate={d.ai_attribution.high_conf_accurate}
                      total={d.ai_attribution.high_conf_trades}
                    />
                    <AccuracyBar
                      label="Lower confidence (<70%)"
                      accurate={d.ai_attribution.low_conf_accurate}
                      total={d.ai_attribution.low_conf_trades}
                    />
                  </div>
                ) : null}
              </div>

              {/* Methodology note */}
              <div className="bg-white px-4 sm:px-8 py-6">
                <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568] mb-4">Attribution Methodology</p>
                <div className="space-y-4 text-[13px] text-[#4A5568] leading-relaxed">
                  <p>
                    Each AI recommendation is classified as profitable when the associated holding shows positive unrealized P&amp;L at the time of evaluation.
                  </p>
                  <p>
                    High-confidence trades ({'>'}90% model confidence) are tracked separately to validate whether the AI&apos;s certainty correlates with outcome quality.
                  </p>
                  <p>
                    This attribution is updated in real time as market prices change, providing a live signal of model performance.
                  </p>
                </div>

                {!loading && d && (
                  <div className="mt-6 border-t border-[#E2E8F0] pt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]">AI Trades</p>
                      <p className="font-mono text-[18px] tabular-nums text-[#0A1628] mt-1">{d.ai_attribution.total_ai_trades}</p>
                    </div>
                    <div>
                      <p className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]">Profitable</p>
                      <p className="font-mono text-[18px] tabular-nums mt-1" style={{ color: posColor(d.ai_attribution.profitable_ai_trades / Math.max(d.ai_attribution.total_ai_trades, 1) * 100 - 50) }}>
                        {d.ai_attribution.profitable_ai_trades}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Footer disclaimer ──────────────────────────────────────────────── */}
          <div className="pb-2 text-center">
            <p className="text-[10px] text-[#4A5568]/50 tracking-[0.06em]">
              Portfolio history generated synthetically for display purposes. Past performance does not guarantee future results.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
