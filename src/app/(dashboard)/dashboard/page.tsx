'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { TopBar }                 from '@/components/layout/TopBar';
import { StatCard }               from '@/components/dashboard/StatCard';
import { PortfolioChart }         from '@/components/dashboard/PortfolioChart';
import { LiveEquityTicker }       from '@/components/dashboard/LiveEquityTicker';
import { SectorAllocation }       from '@/components/dashboard/SectorAllocation';
import { AllocationChart }        from '@/components/dashboard/AllocationChart';
import { AIFeed }                 from '@/components/dashboard/AIFeed';
import { AnalysisOverlay }        from '@/components/dashboard/AnalysisOverlay';
import { RecommendationsSection } from '@/components/dashboard/RecommendationsSection';
import { MarketTabs }             from '@/components/dashboard/MarketTabs';
import { Toast }                  from '@/components/ui/Toast';
import type { ToastData }         from '@/components/ui/Toast';
import type { PortfolioData }     from '@/app/api/alpaca/portfolio/route';
import type { ChartApiResponse }  from '@/app/api/portfolio/chart/route';

import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { createClient }    from '@/lib/supabase/client';
import type { AIInsight, AutoInvestResult, InvestMode, TradeRecommendation } from '@/types';
import type { SyncedHolding } from '@/lib/alpaca/sync';

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
  const [chartData, setChartData] = useState<ChartApiResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

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

  // ── Fetch chart data ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/portfolio/chart')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ChartApiResponse | null) => setChartData(d))
      .catch(() => null)
      .finally(() => setChartLoading(false));
  }, []);

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

  const allocData  = p?.allocation ?? [];
  const holdings: SyncedHolding[] = p?.holdings ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title={firstName ? `Dashboard — ${firstName}` : 'Dashboard'}
        onRunAnalysis={runAnalysis}
        analyzing={analyzing}
        mode={mode}
        onModeChange={setMode}
      />

      <main className="relative flex-1 overflow-y-auto bg-[#F8F9FA]">
        <AnimatePresence>{analyzing && <AnalysisOverlay />}</AnimatePresence>

        {/* ── Live equity ticker (navy dark band) ─────────────────────────── */}
        <LiveEquityTicker
          initialEquity={p?.equity ?? 0}
          initialDayPl={p?.day_pl ?? 0}
          initialDayPlPct={p?.day_pl_pct ?? 0}
        />


        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          {/* ── Compact stat strip ────────────────────────────────────────────── */}
          <div className="border border-[#E2E8F0] bg-[#E2E8F0]">
            <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
              <div className="relative bg-white">
                <div className="absolute inset-y-0 left-0 w-0.5 bg-[#B8960C]" />
                <StatCard
                  title="Portfolio Value"
                  value={portfolioValue}
                  change={dayPlChange}
                  changePositive={p ? p.day_pl >= 0 : undefined}
                  loading={loading}
                />
              </div>
              <div className="bg-white">
                <StatCard
                  title="Day P&L"
                  value={dayPl}
                  change={dayPlPct}
                  changePositive={p ? p.day_pl >= 0 : undefined}
                  loading={loading}
                />
              </div>
              <div className="bg-white">
                <StatCard
                  title="Total Return"
                  value={totalReturn}
                  change={totalReturnPct}
                  changePositive={p ? p.total_return >= 0 : undefined}
                  loading={loading}
                />
              </div>
              <div className="bg-white">
                <StatCard
                  title="Cash Available"
                  value={cashAvailable}
                  loading={loading}
                />
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

          {/* ── Portfolio chart (90-day area chart with benchmark) ───────────── */}
          <section>
            <PortfolioChart data={chartData} loading={chartLoading} />
          </section>

          {/* ── Sector allocation + top holdings ────────────────────────────── */}
          <section>
            <div className="grid gap-6 lg:grid-cols-2">
              <SectorAllocation holdings={holdings} />

              {/* Top holdings list */}
              <div className="bg-white border border-[#E2E8F0] px-6 py-5">
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568] mb-4">
                  Top Holdings</p>
                {holdings.length === 0 ? (
                  <p className="text-sm text-[#4A5568]">No positions</p>
                ) : (
                  <div className="space-y-3">
                    {holdings.slice(0, 8).map((h) => {
                      const plPos = h.unrealized_pl >= 0;
                      return (
                        <div key={h.ticker} className="flex items-center justify-between">
                          <div>
                            <span className="font-mono text-[13px] text-[#0A1628]">{h.ticker}</span>
                            <span className="ml-2 text-[11px] text-[#4A5568]">
                              {h.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })} sh
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-[13px] text-[#0A1628]">
                              ${h.market_value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                            <p
                              className="font-mono text-[11px]"
                              style={{ color: plPos ? '#166534' : '#991b1b' }}
                            >
                              {plPos ? '+' : ''}{(h.unrealized_plpc * 100).toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Allocation chart ─────────────────────────────────────────────── */}
          {allocData.length > 0 && (
            <section>
              <div className="grid gap-px bg-[#E2E8F0] lg:grid-cols-3">
                <div className="lg:col-span-1">
                  <AllocationChart data={allocData} />
                </div>
              </div>
            </section>
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
