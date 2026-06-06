'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { PortfolioChartPoint } from '@/types';

interface PortfolioChartProps {
  data: PortfolioChartPoint[];
}

export function PortfolioChart({ data }: PortfolioChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Value</CardTitle>
      </CardHeader>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#B8960C" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#B8960C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#4A5568' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#4A5568' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Value']}
            contentStyle={{
              border: '1px solid #E2E8F0',
              borderRadius: 0,
              boxShadow: 'none',
              backgroundColor: '#ffffff',
              fontSize: 12,
              color: '#0A1628',
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#B8960C"
            strokeWidth={1.5}
            fill="url(#portfolioGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
