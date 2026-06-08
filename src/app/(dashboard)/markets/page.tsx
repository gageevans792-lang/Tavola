'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import type { NewsItem, NewsCategory } from '@/app/api/market/news/route';

type NewsSourceFilter = 'reuters' | 'wsj';
type NewsFilter = 'all' | NewsCategory | NewsSourceFilter;
import type { SignalsResponse, MarketEvent } from '@/app/api/market/brief/route';
import type { SnapshotTile, SnapshotResponse } from '@/app/api/market/snapshot/route';

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (!n) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChangePct(pct: number): string {
  if (!pct) return '—';
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  if (mins  < 1)  return 'now';
  if (mins  < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function fmtSignalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────

function PulseSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px sm:grid-cols-5 bg-[#E2E8F0]">
      {[1,2,3,4,5].map((i) => (
        <div key={i} className="bg-white px-5 py-4 space-y-2">
          <div className="h-2.5 w-14 animate-pulse bg-[#E2E8F0]" />
          <div className="h-6   w-24 animate-pulse bg-[#E2E8F0]" />
          <div className="h-3   w-14 animate-pulse bg-[#E2E8F0]" />
        </div>
      ))}
    </div>
  );
}

function SignalsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-px sm:grid-cols-3 bg-[#E2E8F0]">
      {[1,2,3].map((i) => (
        <div key={i} className="bg-white border-l-2 border-[#B8960C] px-5 py-4 space-y-3">
          <div className="h-2.5 w-16 animate-pulse bg-[#E2E8F0]" />
          <div className="h-4   w-full animate-pulse bg-[#E2E8F0]" />
          <div className="h-4   w-3/4 animate-pulse bg-[#E2E8F0]" />
          <div className="h-2.5 w-20 animate-pulse bg-[#E2E8F0]" />
        </div>
      ))}
    </div>
  );
}

// ── Impact badge ──────────────────────────────────────────────────────────────

const IMPACT_STYLE: Record<string, string> = {
  high:   'text-[#C41E3A] border border-[#C41E3A]/30',
  medium: 'text-[#B8960C] border border-[#B8960C]/30',
  low:    'text-[#4A5568] border border-[#E2E8F0]',
};

const IMPACT_LABEL: Record<string, string> = {
  high:   'HIGH',
  medium: 'MED',
  low:    'LOW',
};

// ── Page ─────────────────────────────────────────────────────────────────────

const NEWS_FILTERS: { key: NewsFilter; label: string }[] = [
  { key: 'all',          label: 'ALL'          },
  { key: 'positions',    label: 'POSITIONS'    },
  { key: 'macro',        label: 'MACRO'        },
  { key: 'geopolitical', label: 'GEOPOLITICAL' },
  { key: 'reuters',      label: 'REUTERS'      },
  { key: 'wsj',          label: 'WSJ'          },
];

const SIGNAL_CARDS: Array<{
  key: keyof SignalsResponse['signals'];
  label: string;
}> = [
  { key: 'market_sentiment', label: 'MARKET SENTIMENT' },
  { key: 'your_portfolio',   label: 'YOUR PORTFOLIO'   },
  { key: 'top_opportunity',  label: 'TOP OPPORTUNITY'  },
];

export default function MarketsPage() {
  const [pulse,   setPulse]   = useState<SnapshotTile[]>([]);
  const [sectors, setSectors] = useState<SnapshotTile[]>([]);
  const [snapLoading, setSnapLoading] = useState(true);

  const [signals, setSignals]         = useState<SignalsResponse | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(true);

  const [news, setNews]               = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsFilter, setNewsFilter]   = useState<NewsFilter>('all');
  const [visibleCount, setVisibleCount] = useState(10);

  const signalsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const newsTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetchers ─────────────────────────────────────────────────────────────────

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/market/snapshot');
      if (res.ok) {
        const data: SnapshotResponse = await res.json();
        setPulse(data.pulse   ?? []);
        setSectors(data.sectors ?? []);
      }
    } catch { /* non-fatal */ } finally {
      setSnapLoading(false);
    }
  }, []);

  const fetchSignals = useCallback(async () => {
    setSignalsLoading(true);
    try {
      const res = await fetch('/api/market/brief', { method: 'POST' });
      if (res.ok) setSignals(await res.json());
    } catch { /* non-fatal */ } finally {
      setSignalsLoading(false);
    }
  }, []);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/market/news');
      if (res.ok) setNews(await res.json());
    } catch { /* non-fatal */ } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
    fetchSignals();
    fetchNews();

    // Signals auto-refresh every 15 min
    signalsTimerRef.current = setInterval(fetchSignals, 15 * 60_000);
    // News auto-refresh every 5 min
    newsTimerRef.current = setInterval(fetchNews, 5 * 60_000);

    return () => {
      if (signalsTimerRef.current) clearInterval(signalsTimerRef.current);
      if (newsTimerRef.current)    clearInterval(newsTimerRef.current);
    };
  }, [fetchSnapshot, fetchSignals, fetchNews]);

  // ── Derived data ──────────────────────────────────────────────────────────────

  const filteredNews = (() => {
    if (newsFilter === 'all')     return news;
    if (newsFilter === 'reuters') return news.filter((item) => item.source.startsWith('REUTERS'));
    if (newsFilter === 'wsj')     return news.filter((item) => item.source.startsWith('WSJ'));
    return news.filter((item) => item.categories.includes(newsFilter as NewsCategory));
  })();

  const visibleNews    = filteredNews.slice(0, visibleCount);
  const hasMoreNews    = filteredNews.length > visibleCount;
  const marketEvents   = (signals?.events ?? []) as MarketEvent[];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Markets" />

      <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
        <div className="mx-auto max-w-7xl space-y-0 divide-y divide-[#E2E8F0]">

          {/* ── S1: Market Pulse ─────────────────────────────────────────────── */}
          <section className="bg-white">
            {snapLoading ? <PulseSkeleton /> : (
              <div className="grid grid-cols-2 gap-px sm:grid-cols-5 bg-[#E2E8F0]">
                {pulse.map((tile) => {
                  const pos = tile.change_pct > 0;
                  const neg = tile.change_pct < 0;
                  return (
                    <div key={tile.symbol} className="bg-white px-5 py-4">
                      <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">{tile.label}</p>
                      <p className="mt-1.5 font-serif text-[24px] font-light leading-none text-[#0A1628]">
                        {fmtPrice(tile.price)}
                      </p>
                      <p className={cn(
                        'mt-1 text-[13px] font-medium',
                        pos ? 'text-[#16A34A]' : neg ? 'text-[#C41E3A]' : 'text-[#4A5568]',
                      )}>
                        {pos ? '▲' : neg ? '▼' : ''} {fmtChangePct(tile.change_pct)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── S2: AI Signals ───────────────────────────────────────────────── */}
          <section className="bg-[#F8F9FA] px-4 py-4 sm:px-6">
            {signalsLoading ? <SignalsSkeleton /> : (
              <div className="grid grid-cols-1 gap-px sm:grid-cols-3 bg-[#E2E8F0]">
                {SIGNAL_CARDS.map(({ key, label }) => {
                  const text = signals?.signals[key] ?? '';
                  return (
                    <div key={key} className="bg-white border-l-2 border-[#B8960C] px-5 py-4">
                      <p className="text-[9px] tracking-[0.22em] uppercase text-[#B8960C] mb-2">
                        AI SIGNAL · {label}
                      </p>
                      <p className="font-serif text-[15px] font-light leading-snug text-[#0A1628]">
                        {text || '—'}
                      </p>
                      {signals && (
                        <p className="mt-3 text-[10px] text-[#4A5568]">
                          {fmtSignalTime(signals.generated_at)}
                          {' · '}
                          <button
                            onClick={fetchSignals}
                            className="hover:text-[#0A1628] transition-colors"
                          >
                            Refresh
                          </button>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── S3 + S4: Events (60%) + Intelligence (40%) ───────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F0]">

            {/* S3: Market Events */}
            <div className="lg:col-span-3 bg-white">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0]">
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Market Events</p>
                <p className="text-[10px] text-[#4A5568]">This week</p>
              </div>

              {newsLoading ? (
                <div className="divide-y divide-[#E2E8F0]">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4">
                      <div className="h-6 w-14 animate-pulse bg-[#E2E8F0] shrink-0" />
                      <div className="flex-1 h-4 animate-pulse bg-[#E2E8F0]" />
                      <div className="h-5 w-10 animate-pulse bg-[#E2E8F0] shrink-0" />
                    </div>
                  ))}
                </div>
              ) : marketEvents.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-[#4A5568]">No events detected in current news feed.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {marketEvents.map((evt, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                      {/* Date pill */}
                      <div className="shrink-0 border border-[#B8960C]/40 px-2 py-0.5 min-w-[52px] text-center">
                        <span className="text-[10px] tracking-[0.08em] uppercase text-[#B8960C]">
                          {new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      {/* Event title */}
                      <p className="flex-1 text-[13px] font-medium text-[#0A1628] truncate">{evt.title}</p>

                      {/* Ticker (optional) */}
                      {evt.ticker && (
                        <span className="shrink-0 text-[10px] tracking-[0.08em] text-[#4A5568] border border-[#E2E8F0] px-1.5 py-0.5">
                          {evt.ticker}
                        </span>
                      )}

                      {/* Impact badge */}
                      <span className={cn(
                        'shrink-0 px-2 py-0.5 text-[9px] tracking-[0.1em] uppercase font-medium',
                        IMPACT_STYLE[evt.impact] ?? IMPACT_STYLE['low'],
                      )}>
                        {IMPACT_LABEL[evt.impact] ?? evt.impact.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* S4: Live Intelligence */}
            <div className="lg:col-span-2 bg-white flex flex-col">
              {/* Header + filter pills */}
              <div className="px-5 py-3 border-b border-[#E2E8F0]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Live Intelligence</p>
                  <button
                    onClick={() => { fetchNews(); setVisibleCount(10); }}
                    className="text-[10px] tracking-[0.08em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors"
                  >
                    Refresh
                  </button>
                </div>
                {/* Filter pills — dot-separated */}
                <div className="flex items-center gap-0 flex-wrap">
                  {NEWS_FILTERS.map(({ key, label }, i) => (
                    <span key={key} className="flex items-center">
                      {i > 0 && <span className="mx-1.5 text-[#E2E8F0]">·</span>}
                      <button
                        onClick={() => { setNewsFilter(key); setVisibleCount(10); }}
                        className={cn(
                          'text-[10px] tracking-[0.1em] uppercase transition-colors',
                          newsFilter === key
                            ? 'text-[#0A1628] font-medium'
                            : 'text-[#4A5568] hover:text-[#0A1628]',
                        )}
                      >
                        {label}
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* News rows */}
              <div className="flex-1 overflow-y-auto">
                {newsLoading ? (
                  <div className="divide-y divide-[#E2E8F0]">
                    {[1,2,3,4,5,6,7,8].map((i) => (
                      <div key={i} className="flex items-baseline gap-2 px-4 py-2.5">
                        <div className="h-2.5 w-10 animate-pulse bg-[#E2E8F0] shrink-0" />
                        <div className="flex-1 h-3 animate-pulse bg-[#E2E8F0]" />
                        <div className="h-2.5 w-5 animate-pulse bg-[#E2E8F0] shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : visibleNews.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-[#4A5568]">No market intelligence available.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E8F0]">
                    {visibleNews.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-baseline gap-2 px-4 py-2.5 hover:bg-[#F8F9FA] transition-colors group"
                      >
                        <span className="shrink-0 text-[9px] tracking-[0.12em] uppercase text-[#B8960C] w-16 truncate">
                          {item.source}
                        </span>
                        <span className="flex-1 text-[13px] text-[#0A1628] truncate group-hover:text-[#B8960C] transition-colors min-w-0">
                          {item.headline}
                        </span>
                        <span className="shrink-0 text-[10px] text-[#4A5568]">
                          {timeAgo(item.published_at)}
                        </span>
                      </a>
                    ))}
                    {hasMoreNews && (
                      <button
                        onClick={() => setVisibleCount((c) => c + 10)}
                        className="w-full px-4 py-2.5 text-[11px] tracking-[0.1em] uppercase text-[#4A5568] hover:text-[#0A1628] hover:bg-[#F8F9FA] transition-colors text-left"
                      >
                        Load more
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── S5: Sector Performance ───────────────────────────────────────── */}
          <section className="bg-white">
            <div className="px-5 py-3 border-b border-[#E2E8F0]">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Sector Performance</p>
            </div>

            {snapLoading ? (
              <div className="grid grid-cols-3 gap-px sm:grid-cols-7 bg-[#E2E8F0] border-b border-[#E2E8F0]">
                {[1,2,3,4,5,6,7].map((i) => (
                  <div key={i} className="bg-white px-4 py-3 space-y-1.5">
                    <div className="h-2.5 w-16 animate-pulse bg-[#E2E8F0]" />
                    <div className="h-5   w-12 animate-pulse bg-[#E2E8F0]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-px sm:grid-cols-7 bg-[#E2E8F0]">
                {sectors.map((tile) => {
                  const pos = tile.change_pct > 0;
                  const neg = tile.change_pct < 0;
                  return (
                    <div key={tile.symbol} className="bg-white px-4 py-3">
                      <p className="text-[10px] tracking-[0.08em] uppercase text-[#4A5568] truncate">{tile.label}</p>
                      <p className="text-[9px] text-[#4A5568]/60 mb-0.5">{tile.symbol}</p>
                      <p className={cn(
                        'mt-1 font-serif text-[18px] font-light leading-none',
                        pos ? 'text-[#16A34A]' : neg ? 'text-[#C41E3A]' : 'text-[#4A5568]',
                      )}>
                        {pos ? '▲' : neg ? '▼' : ''} {tile.change_pct ? Math.abs(tile.change_pct).toFixed(2) + '%' : '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
