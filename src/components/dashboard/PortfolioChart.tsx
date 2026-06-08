'use client';

import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { PortfolioChartPoint } from '@/types';

interface PortfolioChartProps {
  data: PortfolioChartPoint[];
}

const PERIODS = ['1W', '1M', '3M', '1Y', 'ALL'] as const;
type Period = typeof PERIODS[number];

export function PortfolioChart({ data }: PortfolioChartProps) {
  const [activePeriod, setActivePeriod] = useState<Period>('1M');

  return (
    <div className="border border-[#E2E8F0] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
        <p className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568]">Portfolio Performance</p>
        {/* Period tabs */}
        <div className="flex items-center gap-4">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={cn(
                'pb-0.5 text-[11px] tracking-[0.1em] uppercase transition-colors',
                activePeriod === p
                  ? 'border-b border-[#B8960C] text-[#0A1628]'
                  : 'text-[#4A5568] hover:text-[#0A1628]'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="px-2 py-4">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="navyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#0A1628" stopOpacity={0.04} />
                <stop offset="100%" stopColor="#0A1628" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="1 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#4A5568' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#4A5568' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip
              formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Value']}
              labelStyle={{ color: '#4A5568', fontSize: 10 }}
              contentStyle={{
                border: '1px solid #E2E8F0',
                borderRadius: 0,
                boxShadow: 'none',
                backgroundColor: '#ffffff',
                fontSize: 13,
                fontFamily: 'Georgia, serif',
                color: '#0A1628',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0A1628"
              strokeWidth={1.5}
              fill="url(#navyFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
