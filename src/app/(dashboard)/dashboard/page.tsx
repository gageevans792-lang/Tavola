'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { TopBar }                from '@/components/layout/TopBar';
import { StatCard }              from '@/components/dashboard/StatCard';
import { PortfolioChart }        from '@/components/dashboard/PortfolioChart';
import { AllocationChart }       from '@/components/dashboard/AllocationChart';
import { AIFeed }                from '@/components/dashboard/AIFeed';
import { AnalysisOverlay }       from '@/components/dashboard/AnalysisOverlay';
import { RecommendationsSection } from '@/components/dashboard/RecommendationsSection';
import { Toast }                 from '@/components/ui/Toast';
import type { ToastData }        from '@/components/ui/Toast';

import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { createClient }    from '@/lib/supabase/client';
import type { AIInsight, AutoInvestResult, InvestMode, TradeRecommendation } from '@/types';

// ── Mock chart/allocation data (replace with live queries when ready) ─────────

const mockChartData = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  }),
  value: 50000 + Math.sin(i * 0.8) * 8000 + i * 400,
}));

const mockAllocation = [
  { name: 'Tech',    value: 42, color: '#0A1628' },
  { name: 'Finance', value: 23, color: '#B8960C' },
  { name: 'Energy',  value: 15, color: '#4A5568' },
  { name: 'Other',   value: 20, color: '#E2E8F0' },
];

const mockInsights: AIInsight[] = [
  {
    id: '1', user_id: 'mock', type: 'buy', ticker: 'NVDA',
    message: 'NVDA broke above its 50-day MA on high volume. Consider adding exposure with a 3% position.',
    confidence_score: 82, qty: 5, executed: false, created_at: new Date().toISOString(),
  },
  {
    id: '2', user_id: 'mock', type: 'outlook', ticker: null,
    message: 'Portfolio VIX sensitivity is elevated. Consider hedging with puts or reducing tech exposure.',
    confidence_score: null, qty: null, executed: false, created_at: new Date().toISOString(),
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortfolioStats {
  total_value:    number;
  cash:           number;
  day_pl:         number;
  day_pl_percent: number;
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [mode, setMode]           = useLocalStorage<InvestMode>('tavola:invest-mode', 'review');
  const [firstName, setFirstName] = useState<string | null>(null);
  const [stats, setStats]         = useState<PortfolioStats | null>(null);
  const [toast, setToast]         = useState<ToastData | null>(null);

  // ── Load user name ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const name = user?.user_metadata?.full_name as string | undefined;
        if (name) setFirstName(name.split(' ')[0]);
      } catch (err) {
        console.error('[dashboard] failed to load user', err);
      }
    }
    loadUser();
  }, []);

  // ── Fetch live portfolio stats ─────────────────────────────────────────────
  const refreshPortfolio = useCallback(async () => {
    try {
      const res = await fetch('/api/alpaca/portfolio');
      if (!res.ok) return;
      const data: PortfolioStats = await res.json();
      setStats(data);
    } catch {
      // silent — keep showing whatever is currently displayed
    }
  }, []);

  useEffect(() => { refreshPortfolio(); }, [refreshPortfolio]);

  // ── Analysis state ─────────────────────────────────────────────────────────
  const [analyzing, setAnalyzing]             = useState(false);
  const [result, setResult]                   = useState<AutoInvestResult | null>(null);
  const [error, setError]                     = useState<string | null>(null);
  const [executingSymbol, setExecutingSymbol] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/analyze', { method: 'POST' });
      const data: AutoInvestResult = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? 'Analysis failed');
      setResult(data);
    } catch {
      setError('AI analysis temporarily unavailable.');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // ── Execute a single recommendation ───────────────────────────────────────
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
      // Promote from approved → executed in result state
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          approved: prev.approved.filter((r) => r.symbol !== rec.symbol),
          executed: [...prev.executed, { ...rec, order_id: 'manual' }],
        };
      });
    } finally {
      setExecutingSymbol(null);
    }
    // Don't catch here — let the error bubble to RecommendationCard's handleExecute
    // so the card knows the trade failed and doesn't flip to selfExecuted
  }, []);

  // ── Post-execution callback: sync + toast ─────────────────────────────────
  const handleExecuted = useCallback((rec: TradeRecommendation) => {
    // Sync Alpaca positions back to Supabase + refresh stat cards
    refreshPortfolio();

    // Show toast
    const price = rec.estimated_value && rec.qty > 0
      ? rec.estimated_value / rec.qty
      : undefined;
    setToast({ ticker: rec.symbol, action: rec.action as 'buy' | 'sell', qty: rec.qty, price });
  }, [refreshPortfolio]);

  // ── Stat card display values ───────────────────────────────────────────────
  const portfolioValue = stats
    ? `$${fmt(stats.total_value, 0)}`
    : '$—';
  const cashAvailable = stats
    ? `$${fmt(stats.cash, 0)}`
    : '$—';
  const dayPl = stats
    ? `${stats.day_pl >= 0 ? '+' : ''}$${fmt(Math.abs(stats.day_pl), 0)}`
    : '$—';
  const dayPlPct = stats
    ? `${stats.day_pl_percent >= 0 ? '+' : ''}${fmt(Math.abs(stats.day_pl_percent), 2)}%`
    : undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title={firstName ? `Dashboard — ${firstName}` : 'Dashboard'}
        onRunAnalysis={runAnalysis}
        analyzing={analyzing}
        mode={mode}
        onModeChange={setMode}
      />

      <main className="relative flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6">
        <AnimatePresence>{analyzing && <AnalysisOverlay />}</AnimatePresence>

        <div className="mx-auto max-w-7xl space-y-6">

          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Portfolio Value"
              value={portfolioValue}
              change={dayPl !== '$—' ? `${dayPl} today` : undefined}
              changePositive={stats ? stats.day_pl >= 0 : undefined}
            />
            <StatCard
              title="Day P&L"
              value={dayPl}
              change={dayPlPct}
              changePositive={stats ? stats.day_pl >= 0 : undefined}
            />
            <StatCard title="Total Return" value="$—" />
            <StatCard title="Cash Available" value={cashAvailable} />
          </div>

          {/* Error banner */}
          {error && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C41E3A]">
              {error}
            </div>
          )}

          {/* AI recommendations */}
          <AnimatePresence>
            {result && !analyzing && (
              <RecommendationsSection
                result={result}
                onDismiss={() => setResult(null)}
                onExecuteOne={executeOne}
                onExecuted={handleExecuted}
                executingSymbol={executingSymbol}
              />
            )}
          </AnimatePresence>

          {/* Charts */}
          {mockChartData.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <PortfolioChart data={mockChartData} />
              </div>
              <AllocationChart data={mockAllocation} />
            </div>
          ) : (
            <div className="border border-[#E2E8F0] bg-white px-8 py-12 text-center">
              <p className="font-serif text-xl font-light text-[#0A1628] mb-2">No positions yet.</p>
              <p className="text-sm text-[#4A5568]">Deposit funds to get started.</p>
            </div>
          )}

          {/* AI feed */}
          <AIFeed insights={mockInsights} />
        </div>
      </main>

      {/* Toast notification */}
      {toast && (
        <Toast
          data={toast}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
