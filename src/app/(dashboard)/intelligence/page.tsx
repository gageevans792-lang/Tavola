'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import type { SignalsResponse, MarketSignal, SignalType } from '@/app/api/market/signals/route';
import type { Article } from '@/app/api/market/news/route';
import type { Mover } from '@/app/api/market/movers/route';
import type { PortfolioAnalytics } from '@/app/api/portfolio/analytics/route';
import { MarketCommentary } from '@/components/intelligence/MarketCommentary';
import { MarketRegime } from '@/components/intelligence/MarketRegime';
import { PortfolioAlerts } from '@/components/intelligence/PortfolioAlerts';

// ── Local types ───────────────────────────────────────────────────────────────

interface ClockData {
  is_open: boolean;
  next_open: string;
  next_close: string;
}

interface MoversData {
  gainers: Mover[];
  losers: Mover[];
}

type FilterTab = 'all' | 'held' | 'buy' | 'sell';

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
  } catch { /* invalid */ }
  return undefined;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtPrice(n: number): string {
  if (n === 0) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number, showSign = true): string {
  const sign = showSign ? (n >= 0 ? '+' : '') : '';
  return sign + (n * 100).toFixed(2) + '%';
}

function fmtChangePct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

function fmtPL(n: number): string {
  const sign = n >= 0 ? '+$' : '-$';
  return sign + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNextTime(isoString: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  } catch {
    return '—';
  }
}

// ── Signal badge ──────────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<SignalType, string> = {
  strong_buy:  'STRONG BUY',
  buy:         'BUY',
  hold:        'HOLD',
  sell:        'SELL',
  strong_sell: 'STRONG SELL',
  watch:       'WATCH',
  take_profit: 'TAKE PROFIT',
  cut_loss:    'CUT LOSS',
  review:      'REVIEW',
};

function SignalBadge({ signal }: { signal: SignalType }) {
  const label = SIGNAL_LABELS[signal];
  let cls = 'inline-flex items-center px-2 py-0.5 text-[10px] tracking-[0.08em] font-semibold uppercase whitespace-nowrap ';
  switch (signal) {
    case 'strong_buy':
      cls += 'bg-[#166534] text-white';
      break;
    case 'buy':
      cls += 'bg-[#166534]/15 text-[#166534] border border-[#166534]/30';
      break;
    case 'hold':
    case 'watch':
      cls += 'bg-[#4A5568]/10 text-[#4A5568]';
      break;
    case 'review':
      cls += 'bg-amber-50 text-amber-700 border border-amber-200';
      break;
    case 'sell':
      cls += 'bg-[#991b1b]/15 text-[#991b1b] border border-[#991b1b]/30';
      break;
    case 'strong_sell':
      cls += 'bg-[#991b1b] text-white';
      break;
    case 'take_profit':
      cls += 'bg-[#B8960C]/15 text-[#B8960C] border border-[#B8960C]/30';
      break;
    case 'cut_loss':
      cls += 'bg-[#C41E3A]/15 text-[#C41E3A] border border-[#C41E3A]/30';
      break;
    default:
      cls += 'bg-[#4A5568]/10 text-[#4A5568]';
  }
  return <span className={cls}>{label}</span>;
}

// ── Confidence bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 80 ? '#166534' :
    value >= 70 ? '#B8960C' :
    '#4A5568';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-[#E2E8F0]">
        <div
          className="h-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-[#4A5568]">{value}</span>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#E2E8F0] ${className}`} />;
}

// ── Economic events (hardcoded, relative to June 2026) ────────────────────────

const ECONOMIC_EVENTS = [
  { name: 'Federal Reserve Meeting', frequency: 'Monthly', upcoming: 'Jun 17–18, 2026' },
  { name: 'CPI Inflation Report', frequency: 'Monthly', upcoming: 'Jun 11, 2026' },
  { name: 'Non-Farm Payrolls', frequency: 'Monthly', upcoming: 'Jul 2, 2026' },
  { name: 'Earnings Season', frequency: 'Quarterly', upcoming: 'Jul 2026' },
  { name: 'GDP Advance Estimate', frequency: 'Quarterly', upcoming: 'Jul 30, 2026' },
];

// ── Sector colors ─────────────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  Technology: '#3B82F6',
  Healthcare: '#22C55E',
  Financials: '#6366F1',
  Energy: '#F59E0B',
  Consumer: '#EC4899',
  Other: '#94A3B8',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [signals, setSignals] = useState<SignalsResponse | null>(null);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [news, setNews] = useState<Article[]>([]);
  const [movers, setMovers] = useState<MoversData | null>(null);
  const [clock, setClock] = useState<ClockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [refreshIn, setRefreshIn] = useState(60);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const [signalsRes, analyticsRes, newsRes, moversRes, clockRes] = await Promise.allSettled([
      fetch('/api/market/signals').then((r) => r.json() as Promise<SignalsResponse>),
      fetch('/api/portfolio/analytics').then((r) => r.json() as Promise<PortfolioAnalytics>),
      fetch('/api/market/news').then((r) => r.json() as Promise<{ articles: Article[] }>),
      fetch('/api/market/movers').then((r) => r.json() as Promise<MoversData>),
      fetch('/api/market/clock').then((r) => r.json() as Promise<ClockData>),
    ]);

    if (signalsRes.status === 'fulfilled' && !('error' in signalsRes.value)) {
      setSignals(signalsRes.value);
    }
    if (analyticsRes.status === 'fulfilled' && !('error' in analyticsRes.value)) {
      setAnalytics(analyticsRes.value);
    }
    if (newsRes.status === 'fulfilled' && !('error' in newsRes.value)) {
      setNews(newsRes.value.articles ?? []);
    }
    if (moversRes.status === 'fulfilled' && !('error' in moversRes.value)) {
      setMovers(moversRes.value);
    }
    if (clockRes.status === 'fulfilled') {
      setClock(clockRes.value);
    }

    setLoading(false);
    setRefreshIn(60);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 60s + countdown
  useEffect(() => {
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const tick = setInterval(() => {
      setRefreshIn((prev) => (prev <= 1 ? 60 : prev - 1));
    }, 1_000);
    return () => clearInterval(tick);
  }, []);

  // ── Filtered signals ────────────────────────────────────────────────────────

  const filteredSignals: MarketSignal[] = (signals?.signals ?? []).filter((s) => {
    if (activeFilter === 'held') return s.is_held;
    if (activeFilter === 'buy') return ['strong_buy', 'buy'].includes(s.signal);
    if (activeFilter === 'sell') return ['sell', 'strong_sell', 'cut_loss', 'take_profit'].includes(s.signal);
    return true;
  });

  const updatedAt = signals?.generated_at
    ? timeAgo(signals.generated_at)
    : null;

  // ── Market regime (computed from movers data) ───────────────────────────────

  const regime = useMemo(() => {
    if (!movers) return 'neutral' as const;
    const g = movers.gainers.length, l = movers.losers.length;
    const topGain = movers.gainers[0]?.changePct ?? 0;
    const topLoss = Math.abs(movers.losers[0]?.changePct ?? 0);
    if (topGain > 2 && g > l) return 'bull' as const;
    if (topLoss > 2 && l > g) return 'bear' as const;
    return 'neutral' as const;
  }, [movers]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Intelligence" />

      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-8">
        <div className="mx-auto max-w-7xl space-y-10">

          {/* ── Portfolio Alerts (prominent, at top) ─────────────────────────── */}
          <PortfolioAlerts signals={signals?.signals ?? []} />

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div>
            <h2 className="font-serif text-2xl font-light text-[#0A1628]">Market Intelligence</h2>
            <p className="mt-1 text-sm text-[#4A5568]">
              Real-time market signals, technical analysis, and portfolio insights powered by AI.
            </p>
          </div>

          {/* ── Market Status Bar ────────────────────────────────────────────── */}
          <div className="border border-[#E2E8F0] bg-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`h-2 w-2 rounded-full ${clock?.is_open ? 'bg-[#166534]' : 'bg-[#4A5568]'}`}
                style={clock?.is_open ? { boxShadow: '0 0 0 3px rgba(22,101,52,0.15)' } : undefined}
              />
              <span className="text-sm font-medium text-[#0A1628]">
                {clock ? (clock.is_open ? 'Market Open' : 'Market Closed') : '—'}
              </span>
              {clock && !clock.is_open && clock.next_open && (
                <span className="text-xs text-[#4A5568]">
                  Opens {formatNextTime(clock.next_open)}
                </span>
              )}
              {clock && clock.is_open && clock.next_close && (
                <span className="text-xs text-[#4A5568]">
                  Closes {formatNextTime(clock.next_close)}
                </span>
              )}
            </div>
            <div className="text-xs text-[#4A5568] tabular-nums">
              Auto-refreshing in {refreshIn}s
            </div>
          </div>

          {/* ── Market Regime strip ──────────────────────────────────────────── */}
          <MarketRegime
            regime={regime}
            gainersCount={movers?.gainers.length ?? 0}
            losersCount={movers?.losers.length ?? 0}
          />

          {/* ── Main Grid ────────────────────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3">

            {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">

              {/* ── Signals Panel ─────────────────────────────────────────── */}
              <div className="border border-[#E2E8F0] bg-white">
                {/* Panel header */}
                <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] font-medium">
                      Market Signals
                    </span>
                    {signals && (
                      <span className="text-[10px] text-[#4A5568]">
                        {signals.signals.length} tickers
                      </span>
                    )}
                  </div>
                  {updatedAt && (
                    <span className="text-[10px] text-[#4A5568]">Updated {updatedAt}</span>
                  )}
                </div>

                {/* Filter tabs */}
                <div className="flex border-b border-[#E2E8F0] px-6">
                  {(['all', 'held', 'buy', 'sell'] as FilterTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab)}
                      className={`mr-6 py-3 text-[11px] tracking-[0.08em] uppercase font-medium transition-colors ${
                        activeFilter === tab
                          ? 'border-b-2 border-[#B8960C] text-[#0A1628]'
                          : 'text-[#4A5568] hover:text-[#0A1628]'
                      }`}
                    >
                      {tab === 'all' ? 'All' :
                       tab === 'held' ? 'Held' :
                       tab === 'buy' ? 'Buy Signals' :
                       'Sell Signals'}
                    </button>
                  ))}
                </div>

                {/* Table */}
                {loading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : filteredSignals.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-[#4A5568]">
                    No signals match this filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E2E8F0]">
                          {['Ticker', 'Price', 'Signal', 'Confidence', 'Status', 'Notes'].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-[10px] tracking-[0.1em] uppercase text-[#4A5568] font-medium"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSignals.map((sig) => (
                          <tr
                            key={sig.ticker}
                            className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8F9FA] transition-colors"
                          >
                            {/* Ticker */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-medium text-[#0A1628]">{sig.ticker}</span>
                                {sig.is_held && (
                                  <span className="text-[#B8960C] text-xs" title="Held position">●</span>
                                )}
                              </div>
                            </td>
                            {/* Price */}
                            <td className="px-4 py-3 font-mono tabular-nums text-[#0A1628]">
                              {fmtPrice(sig.price)}
                            </td>
                            {/* Signal */}
                            <td className="px-4 py-3">
                              <SignalBadge signal={sig.signal} />
                            </td>
                            {/* Confidence */}
                            <td className="px-4 py-3">
                              <ConfidenceBar value={sig.confidence} />
                            </td>
                            {/* Status (P&L for held, N/A for others) */}
                            <td className="px-4 py-3 font-mono tabular-nums text-sm">
                              {sig.is_held && sig.unrealized_plpc !== undefined ? (
                                <span className={sig.unrealized_plpc >= 0 ? 'text-[#166534]' : 'text-[#991b1b]'}>
                                  {fmtPct(sig.unrealized_plpc)}
                                </span>
                              ) : (
                                <span className="text-[#4A5568] text-xs">—</span>
                              )}
                            </td>
                            {/* Notes */}
                            <td className="px-4 py-3 max-w-xs">
                              <span className="text-xs text-[#4A5568] line-clamp-1" title={sig.reasoning}>
                                {sig.reasoning}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── AI Market Commentary ──────────────────────────────────── */}
              <MarketCommentary />

              {/* ── Portfolio Analytics ───────────────────────────────────── */}
              <div className="border border-[#E2E8F0] bg-white">
                <div className="border-b border-[#E2E8F0] px-6 py-4">
                  <span className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] font-medium">
                    Portfolio Analytics
                  </span>
                </div>

                {loading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Win Rate */}
                      <div className="border border-[#E2E8F0] p-4">
                        <p className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568] mb-2">Win Rate</p>
                        <p className="font-mono text-xl tabular-nums font-medium text-[#0A1628]">
                          {analytics ? `${analytics.win_rate}%` : '—'}
                        </p>
                        {analytics && (
                          <div className="mt-2 h-1 bg-[#E2E8F0]">
                            <div
                              className="h-full"
                              style={{
                                width: `${analytics.win_rate}%`,
                                backgroundColor: analytics.win_rate >= 50 ? '#166534' : '#991b1b',
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Open Positions */}
                      <div className="border border-[#E2E8F0] p-4">
                        <p className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568] mb-2">Open Positions</p>
                        <p className="font-mono text-xl tabular-nums font-medium text-[#0A1628]">
                          {analytics ? analytics.position_count : '—'}
                        </p>
                      </div>

                      {/* Total Unrealized P&L */}
                      <div className="border border-[#E2E8F0] p-4">
                        <p className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568] mb-2">Unrealized P&amp;L</p>
                        {analytics ? (
                          <p
                            className="font-mono text-xl tabular-nums font-medium"
                            style={{ color: analytics.total_unrealized_pl >= 0 ? '#166534' : '#991b1b' }}
                          >
                            {fmtPL(analytics.total_unrealized_pl)}
                          </p>
                        ) : (
                          <p className="font-mono text-xl tabular-nums font-medium text-[#0A1628]">—</p>
                        )}
                      </div>

                      {/* Concentration Risk */}
                      <div className="border border-[#E2E8F0] p-4">
                        <p className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568] mb-2">Concentration Risk</p>
                        {analytics ? (
                          <span
                            className={`inline-block px-2 py-1 text-xs font-semibold uppercase tracking-wider ${
                              analytics.concentration_risk === 'high'
                                ? 'bg-[#C41E3A]/10 text-[#C41E3A]'
                                : analytics.concentration_risk === 'medium'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-[#166534]/10 text-[#166534]'
                            }`}
                          >
                            {analytics.concentration_risk}
                          </span>
                        ) : (
                          <p className="text-[#4A5568]">—</p>
                        )}
                      </div>
                    </div>

                    {/* Best/Worst performers */}
                    {analytics && (analytics.best_performer || analytics.worst_performer) && (
                      <div className="grid grid-cols-2 gap-4">
                        {analytics.best_performer && (
                          <div className="flex items-center gap-2 border border-[#E2E8F0] px-4 py-3">
                            <span className="text-[#166534] text-xs font-medium uppercase tracking-wide">Best</span>
                            <span className="font-mono font-medium text-[#0A1628]">{analytics.best_performer.symbol}</span>
                            <span className="ml-auto font-mono text-[#166534] tabular-nums text-sm">
                              {fmtPct(analytics.best_performer.unrealized_plpc)}
                            </span>
                          </div>
                        )}
                        {analytics.worst_performer && (
                          <div className="flex items-center gap-2 border border-[#E2E8F0] px-4 py-3">
                            <span className="text-[#991b1b] text-xs font-medium uppercase tracking-wide">Worst</span>
                            <span className="font-mono font-medium text-[#0A1628]">{analytics.worst_performer.symbol}</span>
                            <span className="ml-auto font-mono text-[#991b1b] tabular-nums text-sm">
                              {fmtPct(analytics.worst_performer.unrealized_plpc)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sector Exposure */}
                    {analytics && Object.keys(analytics.sector_exposure).length > 0 && (
                      <div>
                        <p className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] font-medium mb-3">
                          Sector Exposure
                        </p>
                        <div className="space-y-2">
                          {Object.entries(analytics.sector_exposure)
                            .sort(([, a], [, b]) => b - a)
                            .map(([sector, pct]) => (
                              <div key={sector} className="flex items-center gap-3">
                                <span className="w-24 text-xs text-[#4A5568] truncate">{sector}</span>
                                <div className="flex-1 h-2 bg-[#E2E8F0]">
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: SECTOR_COLORS[sector] ?? SECTOR_COLORS['Other'],
                                    }}
                                  />
                                </div>
                                <span className="w-10 text-right text-xs tabular-nums text-[#4A5568]">{pct}%</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {!analytics && !loading && (
                      <p className="text-sm text-[#4A5568] text-center py-4">
                        No portfolio data available.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
            <div className="space-y-6">

              {/* ── Market Movers ─────────────────────────────────────────── */}
              <div className="border border-[#E2E8F0] bg-white p-6">
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] font-medium mb-4">
                  Today&apos;s Movers
                </p>

                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Gainers */}
                    <div>
                      <p className="text-[10px] tracking-[0.12em] uppercase text-[#166534] font-semibold mb-2">
                        Gainers
                      </p>
                      {(movers?.gainers ?? []).length === 0 ? (
                        <p className="text-xs text-[#4A5568]">No data</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(movers?.gainers ?? []).map((g) => (
                            <div key={g.symbol} className="flex items-center justify-between">
                              <span className="font-mono text-sm font-medium text-[#0A1628]">{g.symbol}</span>
                              <span className="font-mono text-sm tabular-nums text-[#166534]">
                                +{g.changePct.toFixed(2)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Losers */}
                    <div>
                      <p className="text-[10px] tracking-[0.12em] uppercase text-[#991b1b] font-semibold mb-2">
                        Losers
                      </p>
                      {(movers?.losers ?? []).length === 0 ? (
                        <p className="text-xs text-[#4A5568]">No data</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(movers?.losers ?? []).map((g) => (
                            <div key={g.symbol} className="flex items-center justify-between">
                              <span className="font-mono text-sm font-medium text-[#0A1628]">{g.symbol}</span>
                              <span className="font-mono text-sm tabular-nums text-[#991b1b]">
                                {fmtChangePct(g.changePct)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Live News Feed ────────────────────────────────────────── */}
              <div className="border border-[#E2E8F0] bg-white">
                <div className="border-b border-[#E2E8F0] px-6 py-4">
                  <p className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] font-medium">
                    Market News
                  </p>
                </div>

                {loading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <div>
                    {news.slice(0, 5).map((article, idx) => (
                      <div
                        key={article.id}
                        className={`px-6 py-3 ${idx < 4 ? 'border-b border-[#E2E8F0]' : ''}`}
                      >
                        <p className="text-[10px] text-[#4A5568] uppercase tracking-wider mb-0.5">
                          {article.source}
                        </p>
                        {safeUrl(article.url) ? (
                          <a
                            href={safeUrl(article.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-[#0A1628] hover:text-[#B8960C] transition-colors leading-snug block"
                          >
                            {article.headline}
                          </a>
                        ) : (
                          <span className="text-xs font-medium text-[#0A1628] leading-snug block">
                            {article.headline}
                          </span>
                        )}
                        <p className="text-[10px] text-[#4A5568] mt-0.5">{timeAgo(article.created_at)}</p>
                      </div>
                    ))}
                    {news.length === 0 && (
                      <p className="px-6 py-4 text-sm text-[#4A5568]">No articles available.</p>
                    )}
                    <div className="px-6 py-3 border-t border-[#E2E8F0]">
                      <span className="text-xs text-[#B8960C]">View all &rarr;</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Key Economic Events ───────────────────────────────────── */}
              <div className="border border-[#E2E8F0] bg-white p-6">
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] font-medium mb-4">
                  Market Calendar
                </p>
                <div className="space-y-3">
                  {ECONOMIC_EVENTS.map((event) => (
                    <div key={event.name} className="flex items-start gap-2">
                      <span className="text-[#B8960C] text-xs mt-0.5">●</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-[#0A1628]">{event.name}</p>
                        <p className="text-[10px] text-[#4A5568]">{event.upcoming} · {event.frequency}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[10px] text-[#4A5568] border-t border-[#E2E8F0] pt-3 leading-relaxed">
                  Calendar events are indicative. Check official sources for exact dates.
                </p>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
