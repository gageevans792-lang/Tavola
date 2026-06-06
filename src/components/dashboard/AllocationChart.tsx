'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { AllocationSlice } from '@/types';

interface AllocationChartProps {
  data: AllocationSlice[];
}

export function AllocationChart({ data }: AllocationChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocation</CardTitle>
      </CardHeader>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Allocation']}
            contentStyle={{
              border: '1px solid #E2E8F0',
              borderRadius: 0,
              boxShadow: 'none',
              backgroundColor: '#ffffff',
              fontSize: 12,
              color: '#0A1628',
            }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: '#0A1628', fontSize: 11 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
