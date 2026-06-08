'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { TopBar }                 from '@/components/layout/TopBar';
import { StatCard }               from '@/components/dashboard/StatCard';
import { PortfolioChart }         from '@/components/dashboard/PortfolioChart';
import { AllocationChart }        from '@/components/dashboard/AllocationChart';
import { AIFeed }                 from '@/components/dashboard/AIFeed';
import { AnalysisOverlay }        from '@/components/dashboard/AnalysisOverlay';
import { RecommendationsSection } from '@/components/dashboard/RecommendationsSection';
import { MarketTabs }             from '@/components/dashboard/MarketTabs';
import { Toast }                  from '@/components/ui/Toast';
import type { ToastData }         from '@/components/ui/Toast';
import type { PortfolioData }     from '@/app/api/alpaca/portfolio/route';

import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { createClient }    from '@/lib/supabase/client';
import type { AIInsight, AutoInvestResult, InvestMode, TradeRecommendation } from '@/types';

// ── Fallback mock insights (dashboard feed) ───────────────────────────────────

const MOCK_INSIGHTS: AIInsight[] = [
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

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtUSD(n: number, decimals = 0): string {
  return '$' + Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(2) + '%';
}

function fmtPL(n: number): string {
  return (n >= 0 ? '+' : '-') + fmtUSD(n, 0);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [mode, setMode]           = useLocalStorage<InvestMode>('tavola:invest-mode', 'review');
  const [firstName, setFirstName] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
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

  // ── Fetch / refresh live portfolio data ────────────────────────────────────
  const refreshPortfolio = useCallback(async () => {
    try {
      const res = await fetch('/api/alpaca/portfolio');
      if (!res.ok) {
        console.warn('[dashboard] portfolio fetch:', res.status, res.statusText);
        return;
      }
      const data: PortfolioData = await res.json();
      setPortfolio(data);
    } catch (err) {
      console.warn('[dashboard] portfolio fetch error:', err instanceof Error ? err.message : err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPortfolio();
    const id = setInterval(refreshPortfolio, 30_000);
    return () => clearInterval(id);
  }, [refreshPortfolio]);

  // ── Analysis state ─────────────────────────────────────────────────────────
  const [analyzing, setAnalyzing]             = useState(false);
  const [result, setResult]                   = useState<AutoInvestResult | null>(null);
  const [error, setError]                     = useState<string | null>(null);
  const [executingSymbol, setExecutingSymbol] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res  = await fetch('/api/ai/analyze', { method: 'POST' });
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
  // Re-throws on failure so RecommendationCard knows not to flip selfExecuted.
  const executeOne = useCallback(async (rec: TradeRecommendation) => {
    setExecutingSymbol(rec.symbol);
    try {
      const res = await fetch('/api/alpaca/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ symbol: rec.symbol, qty: rec.qty, side: rec.action }),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed. Please try again.');
      throw err; // re-throw so RecommendationCard stays in pending state
    } finally {
      setExecutingSymbol(null);
    }
  }, []);

  // ── Post-execution: sync portfolio + show toast ────────────────────────────
  const handleExecuted = useCallback((rec: TradeRecommendation) => {
    // Delay 1s to let Alpaca process the order before syncing
    setTimeout(refreshPortfolio, 1_000);

    // Compute approximate per-share price from the risk guard estimate
    const price = rec.estimated_value != null && rec.qty > 0
      ? rec.estimated_value / rec.qty
      : undefined;

    setToast({ ticker: rec.symbol, action: rec.action as 'buy' | 'sell', qty: rec.qty, price });
  }, [refreshPortfolio]);

  // ── Derived display values ─────────────────────────────────────────────────
  const p = portfolio;
  const loading = statsLoading && !p;

  const portfolioValue = loading ? '' : p ? fmtUSD(p.equity)        : '$—';
  const cashAvailable  = loading ? '' : p ? fmtUSD(p.cash)          : '$—';
  const totalReturn    = loading ? '' : p ? fmtPL(p.total_return)   : '$—';
  const totalReturnPct = loading ? undefined : p ? fmtPct(p.total_return_pct) : undefined;
  const dayPl          = loading ? '' : p ? fmtPL(p.day_pl)         : '$—';
  const dayPlPct       = loading ? undefined : p ? fmtPct(p.day_pl_pct) : undefined;
  const dayPlChange    = loading ? undefined : p ? `${fmtPL(p.day_pl)} today` : undefined;

  // Chart: use real Alpaca history if available, otherwise empty (shows empty state)
  const chartData  = p?.chart       ?? [];
  const allocData  = p?.allocation  ?? [];

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

          {/* ── Compact stat strip ────────────────────────────────────────────── */}
          <div className="border border-[#E2E8F0] bg-white flex items-stretch divide-x divide-[#E2E8F0] overflow-x-auto">
            <div className="w-0.5 shrink-0 bg-[#B8960C]" />
            <StatCard
              title="Portfolio Value"
              value={portfolioValue}
              change={dayPlChange}
              changePositive={p ? p.day_pl >= 0 : undefined}
              loading={loading}
            />
            <StatCard
              title="Day P&L"
              value={dayPl}
              change={dayPlPct}
              changePositive={p ? p.day_pl >= 0 : undefined}
              loading={loading}
            />
            <StatCard
              title="Total Return"
              value={totalReturn}
              change={totalReturnPct}
              changePositive={p ? p.total_return >= 0 : undefined}
              loading={loading}
            />
            <StatCard
              title="Cash Available"
              value={cashAvailable}
              loading={loading}
            />
            {/* Market status indicator */}
            <div className="flex flex-col justify-center px-5 py-3 ml-auto shrink-0">
              <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">Market</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#166534] animate-pulse" />
                <span className="font-mono text-[13px] text-[#166534]">Open</span>
              </div>
            </div>
          </div>

          {/* ── Error banner ────────────────────────────────────────────────── */}
          {error && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#C41E3A]">
              {error}
            </div>
          )}

          {/* ── AI recommendations ──────────────────────────────────────────── */}
          <AnimatePresence>
            {result && !analyzing && (
              <section>
                <p className="mb-3 text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">AI Recommendations</p>
                <RecommendationsSection
                  result={result}
                  onDismiss={() => setResult(null)}
                  onExecuteOne={executeOne}
                  onExecuted={handleExecuted}
                  executingSymbol={executingSymbol}
                />
              </section>
            )}
          </AnimatePresence>

          {/* ── Charts ──────────────────────────────────────────────────────── */}
          {chartData.length > 0 ? (
            <section>
              <div className="grid gap-px bg-[#E2E8F0] lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <PortfolioChart data={chartData} />
                </div>
                {allocData.length > 0 ? (
                  <AllocationChart data={allocData} />
                ) : (
                  <div className="border border-[#E2E8F0] bg-white flex items-center justify-center p-8">
                    <p className="text-sm text-[#4A5568] text-center">No positions to display.</p>
                  </div>
                )}
              </div>
            </section>
          ) : (
            !loading && (
              <div className="border border-[#E2E8F0] bg-white px-8 py-12 text-center">
                <p className="font-serif text-xl font-light text-[#0A1628] mb-2">No portfolio data yet.</p>
                <p className="text-sm text-[#4A5568]">
                  {p ? 'Run an AI analysis to get started.' : 'Connect your Alpaca account to see live data.'}
                </p>
              </div>
            )
          )}

          {/* ── AI feed ─────────────────────────────────────────────────────── */}
          <section>
            <AIFeed insights={MOCK_INSIGHTS} />
          </section>

          {/* ── Market intelligence (tabbed) ────────────────────────────────── */}
          <section>
            <MarketTabs />
          </section>

        </div>
      </main>

      {/* ── Toast notification ───────────────────────────────────────────────── */}
      {toast && (
        <Toast data={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
