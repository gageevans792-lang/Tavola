import { TopBar } from '@/components/layout/TopBar';
import { StatCard } from '@/components/dashboard/StatCard';
import { PortfolioChart } from '@/components/dashboard/PortfolioChart';
import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { AIFeed } from '@/components/dashboard/AIFeed';
import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

const mockChartData = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  value: 50000 + Math.random() * 20000 - 5000,
}));

const mockAllocation = [
  { name: 'Tech', value: 42, color: '#6366f1' },
  { name: 'Finance', value: 23, color: '#22d3ee' },
  { name: 'Energy', value: 15, color: '#f59e0b' },
  { name: 'Other', value: 20, color: '#e5e7eb' },
];

const mockInsights = [
  {
    id: '1',
    type: 'recommendation' as const,
    title: 'NVDA showing momentum',
    content: 'NVDA broke above its 50-day MA on high volume. Consider adding exposure with a 3% position.',
    symbol: 'NVDA',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'alert' as const,
    title: 'High volatility detected',
    content: 'Your portfolio VIX sensitivity is elevated. Consider hedging with puts or reducing tech exposure.',
    created_at: new Date().toISOString(),
  },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Dashboard" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Portfolio Value" value="$68,420" change="+$1,240 today" changePositive icon={Wallet} />
            <StatCard title="Day P&L" value="+$1,240" change="+1.84%" changePositive icon={TrendingUp} />
            <StatCard title="Total Return" value="+$18,420" change="+36.8%" changePositive icon={DollarSign} />
            <StatCard title="Cash Available" value="$4,200" icon={TrendingDown} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PortfolioChart data={mockChartData} />
            </div>
            <AllocationChart data={mockAllocation} />
          </div>

          <AIFeed insights={mockInsights} />
        </div>
      </main>
    </div>
  );
}
