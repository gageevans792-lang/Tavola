'use client';

import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ChartApiResponse } from '@/app/api/portfolio/chart/route';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MergedPoint {
  date:      string;
  portfolio: number;
  benchmark: number;
}

// ── Period tabs ───────────────────────────────────────────────────────────────

const PERIODS = ['1M', '3M', '6M', '1Y'] as const;
type Period = typeof PERIODS[number];

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtYAxis(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${(v / 1_000).toFixed(0)}k`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMonthAbbr(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short' });
}

function fmtUSDFull(v: number): string {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name:  string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?:  boolean;
  payload?: TooltipPayloadItem[];
  label?:   string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background:  '#0A1628',
        border:      '1px solid #1E3A5F',
        padding:     '10px 14px',
        fontSize:    12,
        fontFamily:  'ui-monospace, monospace',
        color:       '#ffffff',
      }}
    >
      <p style={{ color: '#B8960C', marginBottom: 6, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label ? fmtDate(label) : ''}
      </p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color, margin: '2px 0' }}>
          <span style={{ color: '#94A3B8', marginRight: 8 }}>{item.name}</span>
          {fmtUSDFull(item.value)}
        </p>
      ))}
    </div>
  );
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="w-full bg-white border border-[#E2E8F0]">
      <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
        <div className="h-3 w-32 bg-[#E2E8F0] animate-pulse" />
        <div className="flex gap-4">
          {PERIODS.map((p) => (
            <div key={p} className="h-3 w-6 bg-[#E2E8F0] animate-pulse" />
          ))}
        </div>
      </div>
      <div className="px-6 py-4 flex gap-8">
        <div className="h-5 w-36 bg-[#E2E8F0] animate-pulse" />
        <div className="h-5 w-36 bg-[#E2E8F0] animate-pulse" />
      </div>
      <div className="px-2 pb-4" style={{ height: 280 }}>
        <div className="w-full h-full bg-[#F8F9FA] animate-pulse" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface PortfolioChartProps {
  data: ChartApiResponse | null;
  loading?: boolean;
}

export function PortfolioChart({ data, loading }: PortfolioChartProps) {
  const [activePeriod, setActivePeriod] = useState<Period>('3M');

  if (loading) return <ChartSkeleton />;

  if (!data) {
    return (
      <div className="w-full bg-white border border-[#E2E8F0] flex items-center justify-center" style={{ height: 360 }}>
        <p className="text-sm text-[#4A5568]">Chart unavailable</p>
      </div>
    );
  }

  // Merge portfolio + benchmark by index (same dates)
  const merged: MergedPoint[] = data.portfolio.map((pt, i) => ({
    date:      pt.date,
    portfolio: pt.value,
    benchmark: data.benchmark[i]?.value ?? pt.value,
  }));

  const periodReturn    = data.period_return;
  const periodReturnStr = (periodReturn >= 0 ? '+' : '') + periodReturn.toFixed(2) + '%';

  // Benchmark return over same period
  const benchStart = data.benchmark[0]?.value ?? 1;
  const benchEnd   = data.benchmark[data.benchmark.length - 1]?.value ?? 1;
  const benchReturn = benchStart > 0 ? ((benchEnd - benchStart) / benchStart) * 100 : 0;
  const benchReturnStr = (benchReturn >= 0 ? '+' : '') + benchReturn.toFixed(2) + '%';
  const vsSpStr = ((periodReturn - benchReturn) >= 0 ? '+' : '') + (periodReturn - benchReturn).toFixed(2) + '%';

  // Show only every ~15th date label to avoid crowding
  const tickFormatter = (iso: string, index: number) => {
    if (index % 15 === 0) return fmtMonthAbbr(iso);
    return '';
  };

  return (
    <div className="w-full bg-white border border-[#E2E8F0]">
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
        <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568]">Portfolio Performance</p>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={[
                'px-3 py-1 text-[10px] tracking-[0.1em] uppercase transition-colors',
                activePeriod === p
                  ? 'bg-[#0A1628] text-white'
                  : 'text-[#4A5568] hover:text-[#0A1628]',
              ].join(' ')}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Legend key */}
      <div className="flex items-center gap-8 px-6 py-3 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <div className="h-px w-8 bg-[#B8960C]" />
          <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]">Portfolio</span>
          <span
            className="font-mono text-[12px] ml-1"
            style={{ color: periodReturn >= 0 ? '#166534' : '#991b1b' }}
          >
            {periodReturnStr}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-px w-8" style={{ borderTop: '1px dashed #4A5568' }} />
          <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]">S&amp;P 500</span>
          <span
            className="font-mono text-[12px] ml-1"
            style={{ color: benchReturn >= 0 ? '#166534' : '#991b1b' }}
          >
            {benchReturnStr}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]">vs S&amp;P 500:</span>
          <span
            className="font-mono text-[12px]"
            style={{ color: (periodReturn - benchReturn) >= 0 ? '#166534' : '#991b1b' }}
          >
            {vsSpStr}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 py-4" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={merged} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioGradientFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#B8960C" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#B8960C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="1 4" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={{ fontSize: 10, fill: '#4A5568' }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              orientation="right"
              tick={{ fontSize: 10, fill: '#4A5568' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtYAxis}
              width={56}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="portfolio"
              name="Portfolio"
              stroke="#B8960C"
              strokeWidth={1.5}
              fill="url(#portfolioGradientFill)"
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
    </div>
  );
}
