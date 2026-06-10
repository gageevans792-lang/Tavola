'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';

import { TopBar }                 from '@/components/layout/TopBar';
import { StatCard }               from '@/components/dashboard/StatCard';
import { PortfolioChart }         from '@/components/dashboard/PortfolioChart';

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
import type { PredictiveSignal }  from '@/app/api/ai/predict/route';
import type { HealthAlert }       from '@/app/api/portfolio/intelligence/route';

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

// ── Time helpers ──────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return 'No analysis yet';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) === 1 ? '' : 's'} ago`;
}

function briefTimeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Updated just now';
  if (mins < 60) return `Updated ${mins} min ago`;
  return `Updated ${Math.floor(mins / 60)}h ago`;
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
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);
  const [signals, setSignals] = useState<PredictiveSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);

  // Feature 3: Health alerts
  const [healthAlerts, setHealthAlerts] = useState<HealthAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Feature 4: AI Status
  const [lastAnalysisAt, setLastAnalysisAt] = useState<string | null>(null);

  // Feature 5: AI Portfolio Brief
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefUpdatedAt, setBriefUpdatedAt] = useState<string | null>(null);

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

  // ── Fetch predictive signals ───────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/ai/predict')
      .then(r => r.ok ? r.json() : { signals: [] })
      .then((d: { signals: PredictiveSignal[] }) => setSignals(d.signals ?? []))
      .catch(() => {})
      .finally(() => setSignalsLoading(false));
  }, []);

  // ── Fetch market clock ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/market/clock')
      .then((r) => r.ok ? r.json() : null)
      .then((d: { is_open?: boolean } | null) => {
        if (d && typeof d.is_open === 'boolean') setMarketOpen(d.is_open);
      })
      .catch(() => {});
  }, []);

  // ── Feature 3: Fetch portfolio intelligence for health alerts ──────────────
  useEffect(() => {
    fetch('/api/portfolio/intelligence', { method: 'POST' })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { health_alerts?: HealthAlert[] } | null) => {
        if (d?.health_alerts) setHealthAlerts(d.health_alerts);
      })
      .catch(() => {});
  }, []);

  // ── Feature 4: Fetch last analysis time ───────────────────────────────────
  useEffect(() => {
    async function fetchLastAnalysis() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('ai_insights')
          .select('created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (data?.created_at) setLastAnalysisAt(data.created_at);
      } catch { /* non-fatal */ }
    }
    fetchLastAnalysis();
  }, []);

  // ── Feature 5: Fetch AI Portfolio Brief ───────────────────────────────────
  const fetchBrief = useCallback(async () => {
    setBriefLoading(true);
    try {
      const res = await fetch('/api/market/brief', { method: 'POST' });
      if (res.ok) {
        const data = await res.json() as { signals?: { your_portfolio?: string; market_sentiment?: string; top_opportunity?: string }; generated_at?: string };
        if (data.signals) {
          const parts = [
            data.signals.market_sentiment,
            data.signals.your_portfolio,
            data.signals.top_opportunity,
          ].filter(Boolean);
          setBrief(parts.join(' '));
          setBriefUpdatedAt(data.generated_at ?? new Date().toISOString());
        }
      }
    } catch { /* non-fatal */ } finally {
      setBriefLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrief();
  }, [fetchBrief]);

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

  const portfolioValue = loading ? '' : p ? fmtUSD(p.equity)        : '$–';
  const cashAvailable  = loading ? '' : p ? fmtUSD(p.cash)          : '$–';
  const totalReturn    = loading ? '' : p ? fmtPL(p.total_return)   : '$–';
  const totalReturnPct = loading ? undefined : p ? fmtPct(p.total_return_pct) : undefined;
  const dayPl          = loading ? '' : p ? fmtPL(p.day_pl)         : '$–';
  const dayPlPct       = loading ? undefined : p ? fmtPct(p.day_pl_pct) : undefined;
  const dayPlChange    = loading ? undefined : p ? `${fmtPL(p.day_pl)} today` : undefined;

  const allocData  = p?.allocation ?? [];
  const holdings: SyncedHolding[] = p?.holdings ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar
        title={firstName ? `Dashboard | ${firstName}` : 'Dashboard'}
        onRunAnalysis={runAnalysis}
        analyzing={analyzing}
        mode={mode}
        onModeChange={setMode}
      />

      <main className="relative flex-1 overflow-y-auto bg-[#F8F9FA]">
        <AnimatePresence>{analyzing && <AnalysisOverlay />}</AnimatePresence>

        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          {/* ── Compact stat strip ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {/* Portfolio Value — gold left accent */}
            <div className="relative bg-white overflow-hidden min-w-0 border border-[#E2E8F0]">
              <div className="absolute inset-y-0 left-0 w-0.5 bg-[#B8960C]" />
              <StatCard
                title="Portfolio Value"
                value={portfolioValue}
                change={dayPlChange}
                changePositive={p ? p.day_pl >= 0 : undefined}
                loading={loading}
              />
            </div>
            {/* Day P&L */}
            <div className="bg-white overflow-hidden min-w-0 border border-[#E2E8F0]">
              <StatCard
                title="Day P&L"
                value={dayPl}
                change={dayPlPct}
                changePositive={p ? p.day_pl >= 0 : undefined}
                loading={loading}
              />
            </div>
            {/* Total Return */}
            <div className="bg-white overflow-hidden min-w-0 border border-[#E2E8F0]">
              <StatCard
                title="Total Return"
                value={totalReturn}
                change={totalReturnPct}
                changePositive={p ? p.total_return >= 0 : undefined}
                loading={loading}
              />
            </div>
            {/* Cash Available */}
            <div className="bg-white overflow-hidden min-w-0 border border-[#E2E8F0]">
              <StatCard
                title="Cash Available"
                value={cashAvailable}
                loading={loading}
              />
            </div>
            {/* Market Status */}
            <div className="bg-white overflow-hidden min-w-0 border border-[#E2E8F0]">
              <StatCard
                title="Market Status"
                value={marketOpen === null ? '–' : marketOpen ? 'Open' : 'Closed'}
                change={marketOpen === null ? undefined : marketOpen ? 'NYSE · Live' : 'NYSE · After hours'}
                changePositive={marketOpen === true ? true : undefined}
                loading={false}
              />
            </div>
          </div>

          {/* ── Portfolio chart (90-day area chart with benchmark) ───────────── */}
          <section>
            <PortfolioChart data={chartData} loading={chartLoading} />
          </section>

          {/* ── AutoPilot Status ─────────────────────────────────────────────── */}
          <section>
            <div className="bg-white border border-[#E2E8F0] px-4 sm:px-6 py-4">
              <p className="text-[9px] tracking-[0.2em] uppercase text-[#B8960C] mb-3">AutoPilot</p>
              <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:divide-x sm:divide-[#E2E8F0]">
                <div className="sm:pr-6">
                  <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568] mb-1">Last Run</p>
                  <p className="text-[13px] font-medium text-[#0A1628]">{timeAgo(lastAnalysisAt)}</p>
                </div>
                <div className="sm:px-6">
                  <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568] mb-1">Positions Monitored</p>
                  <p className="text-[13px] font-medium text-[#0A1628]">{holdings.length} position{holdings.length === 1 ? '' : 's'}</p>
                </div>
                <div className="sm:px-6">
                  <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568] mb-1">Next Scheduled Run</p>
                  <p className="text-[13px] font-medium text-[#0A1628]">Daily at market open</p>
                </div>
                <div className="sm:pl-6">
                  <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568] mb-1">Status</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#B8960C] animate-pulse" />
                    <p className="text-[13px] font-medium text-[#0A1628]">Monitoring 24/7</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Health Alerts ────────────────────────────────────────────────── */}
          {healthAlerts.filter((a) => !dismissedAlerts.has(`${a.type}-${a.message}`)).map((alert) => {
            const key = `${alert.type}-${alert.message}`;
            const borderColor =
              alert.severity === 'critical' ? 'border-l-[#991b1b]' :
              alert.severity === 'warning'  ? 'border-l-[#B8960C]' : 'border-l-[#4A5568]';
            const textColor =
              alert.severity === 'critical' ? 'text-[#991b1b]' :
              alert.severity === 'warning'  ? 'text-[#B8960C]' : 'text-[#4A5568]';
            const bgColor =
              alert.severity === 'critical' ? 'bg-red-50' :
              alert.severity === 'warning'  ? 'bg-amber-50' : 'bg-[#F8F9FA]';
            return (
              <div key={key} className={`flex items-start justify-between border border-[#E2E8F0] border-l-2 ${borderColor} ${bgColor} px-4 py-3`}>
                <p className={`text-sm ${textColor}`}>{alert.message}</p>
                <button
                  onClick={() => setDismissedAlerts((prev) => new Set([...prev, key]))}
                  className="ml-3 shrink-0 text-[#4A5568]/50 hover:text-[#0A1628] transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}

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

          {/* ── Empty state when no positions ─────────────────────────────────── */}
          {!loading && holdings.length === 0 && (
            <section>
              <div className="bg-white border border-[#E2E8F0] px-8 py-12 text-center">
                <p className="text-[10px] tracking-[0.25em] uppercase text-[#B8960C] mb-4">Get Started</p>
                <h3 className="font-serif text-[28px] font-light text-[#0A1628] mb-3 leading-tight">
                  Start your AI investment journey.
                </h3>
                <p className="text-[14px] text-[#4A5568] max-w-sm mx-auto mb-8 leading-relaxed">
                  Deposit funds and let Tavola AI build your portfolio with institutional-grade strategies.
                </p>
                <a
                  href="/deposit"
                  className="inline-block bg-[#B8960C] text-white text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:bg-[#9a7d0a] transition-colors"
                >
                  Deposit Now
                </a>
              </div>
            </section>
          )}

          {/* ── AI Portfolio Brief ────────────────────────────────────────────── */}
          <section>
            <div className="bg-white border border-[#E2E8F0] border-l-2 border-l-[#B8960C] px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] tracking-[0.2em] uppercase text-[#B8960C]">AI Portfolio Brief</p>
                <button
                  onClick={fetchBrief}
                  disabled={briefLoading}
                  className="text-[#4A5568] hover:text-[#0A1628] transition-colors disabled:opacity-40"
                  aria-label="Refresh brief"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${briefLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {briefLoading ? (
                <div className="space-y-2">
                  <div className="h-4 animate-pulse bg-[#E2E8F0] rounded w-full" />
                  <div className="h-4 animate-pulse bg-[#E2E8F0] rounded w-5/6" />
                  <div className="h-4 animate-pulse bg-[#E2E8F0] rounded w-4/5" />
                </div>
              ) : brief ? (
                <>
                  <p className="font-serif text-[18px] font-light text-[#0A1628] leading-relaxed">{brief}</p>
                  {briefUpdatedAt && (
                    <p className="mt-2 text-[10px] text-[#4A5568]/60">{briefTimeAgo(briefUpdatedAt)}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-[#4A5568] italic">Click refresh to generate your AI portfolio brief.</p>
              )}
            </div>
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
                  <p className="text-sm text-[#4A5568] italic">Your portfolio is empty. Make your first trade to see holdings here.</p>
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

          {/* ── Upcoming Catalysts ──────────────────────────────────────────── */}
          <section>
            <div className="bg-white border border-[#E2E8F0]">
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-[#B8960C]">AI Predictive Engine</p>
                  <h3 className="font-serif text-lg font-light text-[#0A1628] mt-0.5">Upcoming Catalysts</h3>
                </div>
              </div>

              {signalsLoading ? (
                <div className="px-6 py-8 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 animate-pulse bg-[#F8F9FA]" />
                  ))}
                </div>
              ) : signals.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-[#4A5568]">No high-impact events in the next 14 days.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {signals.slice(0, 3).map((signal, i) => {
                    const actionColors: Record<string, string> = {
                      increase: '#166534',
                      reduce:   '#991b1b',
                      hedge:    '#B8960C',
                      hold:     '#4A5568',
                    };
                    const actionColor = actionColors[signal.recommended_action] ?? '#4A5568';
                    return (
                      <div key={i} className="px-6 py-5">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#0A1628] truncate">{signal.event}</p>
                            <p className="text-[11px] text-[#4A5568] mt-0.5">
                              {signal.date} · {signal.days_until === 0 ? 'Today' : `in ${signal.days_until}d`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span
                              className="text-[9px] tracking-[0.15em] uppercase font-medium px-2 py-1 border"
                              style={{ color: actionColor, borderColor: actionColor }}
                            >
                              {signal.recommended_action}
                            </span>
                            <span className="font-mono text-[11px] text-[#4A5568] tabular-nums">
                              {signal.confidence}%
                            </span>
                          </div>
                        </div>

                        {/* Affected tickers */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {signal.affected_tickers.slice(0, 4).map(ticker => (
                            <span key={ticker} className="font-mono text-[10px] bg-[#F8F9FA] border border-[#E2E8F0] px-2 py-0.5 text-[#0A1628]">
                              {ticker}
                            </span>
                          ))}
                        </div>

                        {/* Confidence bar */}
                        <div className="h-0.5 bg-[#F8F9FA] mt-3">
                          <div
                            className="h-full transition-all"
                            style={{ width: `${signal.confidence}%`, background: actionColor }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
