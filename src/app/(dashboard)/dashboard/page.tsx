'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { TopBar } from '@/components/layout/TopBar';
import { StatCard } from '@/components/dashboard/StatCard';
import { PortfolioChart } from '@/components/dashboard/PortfolioChart';
import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { AIFeed } from '@/components/dashboard/AIFeed';
import { AnalysisOverlay } from '@/components/dashboard/AnalysisOverlay';
import { RecommendationsSection } from '@/components/dashboard/RecommendationsSection';

import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import type { AIInsight, AutoInvestResult, InvestMode, TradeRecommendation } from '@/types';
import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

// ── Static mock data ─────────────────────────────────────────────────────────

const mockChartData = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }),
  // stable seed so values don't change on every render
  value: 50000 + Math.sin(i * 0.8) * 8000 + i * 400,
}));

const mockAllocation = [
  { name: 'Tech',    value: 42, color: '#6366f1' },
  { name: 'Finance', value: 23, color: '#22d3ee' },
  { name: 'Energy',  value: 15, color: '#f59e0b' },
  { name: 'Other',   value: 20, color: '#e5e7eb' },
];

const mockInsights: AIInsight[] = [
  {
    id: '1',
    user_id: 'mock',
    type: 'buy',
    ticker: 'NVDA',
    message: 'NVDA broke above its 50-day MA on high volume. Consider adding exposure with a 3% position.',
    confidence_score: 82,
    qty: 5,
    executed: false,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    user_id: 'mock',
    type: 'outlook',
    ticker: null,
    message: 'Portfolio VIX sensitivity is elevated. Consider hedging with puts or reducing tech exposure.',
    confidence_score: null,
    qty: null,
    executed: false,
    created_at: new Date().toISOString(),
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [mode, setMode] = useLocalStorage<InvestMode>('tavola:invest-mode', 'review');

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AutoInvestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executingSymbol, setExecutingSymbol] = useState<string | null>(null);

  // ── Run full AI analysis ─────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/analyze', { method: 'POST' });
      const data: AutoInvestResult = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Analysis failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // ── Execute a single recommendation (review mode) ────────────────────────
  const executeOne = useCallback(async (rec: TradeRecommendation) => {
    setExecutingSymbol(rec.symbol);
    try {
      const res = await fetch('/api/alpaca/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: rec.symbol, qty: rec.qty, side: rec.action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Order failed');
      }
      // Promote from approved → executed in local state
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          approved: prev.approved.filter((r) => r.symbol !== rec.symbol),
          executed: [...prev.executed, { ...rec, order_id: 'manual' }],
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setExecutingSymbol(null);
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title="Dashboard"
        onRunAnalysis={runAnalysis}
        analyzing={analyzing}
        mode={mode}
        onModeChange={setMode}
      />

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="relative flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-950">
        {/* Loading overlay — positioned over the scroll area */}
        <AnimatePresence>{analyzing && <AnalysisOverlay />}</AnimatePresence>

        <div className="mx-auto max-w-7xl space-y-6">
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Portfolio Value"
              value="$68,420"
              change="+$1,240 today"
              changePositive
              icon={Wallet}
            />
            <StatCard
              title="Day P&L"
              value="+$1,240"
              change="+1.84%"
              changePositive
              icon={TrendingUp}
            />
            <StatCard
              title="Total Return"
              value="+$18,420"
              change="+36.8%"
              changePositive
              icon={DollarSign}
            />
            <StatCard title="Cash Available" value="$4,200" icon={TrendingDown} />
          </div>

          {/* Error banner */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* AI recommendations — shown immediately after analysis */}
          <AnimatePresence>
            {result && !analyzing && (
              <RecommendationsSection
                result={result}
                onDismiss={() => setResult(null)}
                onExecuteOne={executeOne}
                executingSymbol={executingSymbol}
              />
            )}
          </AnimatePresence>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PortfolioChart data={mockChartData} />
            </div>
            <AllocationChart data={mockAllocation} />
          </div>

          {/* AI feed */}
          <AIFeed insights={mockInsights} />
        </div>
      </main>
    </div>
  );
}
