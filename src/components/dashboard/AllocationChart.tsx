'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { AllocationSlice } from '@/types';

interface AllocationChartProps {
  data: AllocationSlice[];
}

// Design system palette
const PALETTE = ['#0A1628', '#B8960C', '#4A5568', '#6B7280', '#94A3B8', '#CBD5E1', '#E2E8F0'];

export function AllocationChart({ data }: AllocationChartProps) {
  return (
    <div className="border border-[#E2E8F0] bg-white">
      <div className="border-b border-[#E2E8F0] px-6 py-4">
        <p className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568]">Allocation</p>
      </div>

      <div className="flex items-center gap-4 p-4">
        {/* Donut */}
        <div className="relative shrink-0">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Weight']}
                contentStyle={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 0,
                  boxShadow: 'none',
                  backgroundColor: '#ffffff',
                  fontSize: 11,
                  color: '#0A1628',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568]">Allocation</span>
          </div>
        </div>

        {/* Legend */}
        <div className="min-w-0 flex-1 space-y-2">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-2 w-2 shrink-0"
                  style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
                />
                <span className="truncate text-[11px] text-[#0A1628]">{entry.name}</span>
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-[#4A5568]">{Number(entry.value).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
