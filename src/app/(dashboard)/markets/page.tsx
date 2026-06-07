'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import type { NewsItem, NewsCategory } from '@/app/api/market/news/route';
import type { BriefResponse } from '@/app/api/market/brief/route';
import type { SnapshotTile } from '@/app/api/market/snapshot/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  return `${days}d ago`;
}

function fmtPrice(n: number): string {
  if (n === 0) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChange(pct: number): string {
  if (pct === 0) return '—';
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
}

function briefTimestamp(iso: string): string {
  return 'Generated at ' + new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

// Parse the brief text into labelled sections for styled rendering
function parseBrief(text: string): Array<{ heading: string; body: string }> {
  const SECTIONS = ['MARKET OVERVIEW', 'PORTFOLIO IMPACT', 'KEY RISKS', 'OPPORTUNITIES'];
  const parts: Array<{ heading: string; body: string }> = [];

  let remaining = text;
  for (let i = 0; i < SECTIONS.length; i++) {
    const header  = SECTIONS[i];
    const next    = SECTIONS[i + 1];
    const start   = remaining.indexOf(header);
    if (start === -1) continue;
    const bodyStart = start + header.length;
    const end = next ? remaining.indexOf(next, bodyStart) : remaining.length;
    const body = remaining.slice(bodyStart, end !== -1 ? end : undefined).trim();
    parts.push({ heading: header, body });
  }

  return parts.length > 0 ? parts : [{ heading: '', body: text.trim() }];
}

// ── Sub-components ────────────────────────────────────────────────────────────

type FilterTab = 'all' | NewsCategory;
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',        label: 'All'            },
  { key: 'positions',  label: 'Your Positions' },
  { key: 'watchlist',  label: 'Watchlist'      },
  { key: 'macro',      label: 'Macro'          },
];

function SnapshotSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="border border-[#E2E8F0] bg-white p-4 space-y-2">
          <div className="h-3 w-1/2 animate-pulse bg-[#E2E8F0]" />
          <div className="h-6 w-3/4 animate-pulse bg-[#E2E8F0]" />
          <div className="h-3 w-1/3 animate-pulse bg-[#E2E8F0]" />
        </div>
      ))}
    </div>
  );
}

function NewsSkeleton() {
  return (
    <div className="divide-y divide-[#E2E8F0]">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="px-6 py-5 space-y-2">
          <div className="h-3 w-16 animate-pulse bg-[#E2E8F0]" />
          <div className="h-4 w-4/5 animate-pulse bg-[#E2E8F0]" />
          <div className="h-3 w-full animate-pulse bg-[#E2E8F0]" />
          <div className="h-3 w-3/4 animate-pulse bg-[#E2E8F0]" />
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MarketsPage() {
  const [brief, setBrief]               = useState<BriefResponse | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError]     = useState<string | null>(null);

  const [snapshot, setSnapshot]         = useState<SnapshotTile[]>([]);
  const [snapLoading, setSnapLoading]   = useState(true);

  const [news, setNews]                 = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading]   = useState(true);
  const [filter, setFilter]             = useState<FilterTab>('all');

  const newsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch brief ─────────────────────────────────────────────────────────────
  const fetchBrief = useCallback(async () => {
    setBriefLoading(true);
    setBriefError(null);
    try {
      const res = await fetch('/api/market/brief', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate brief');
      const data: BriefResponse = await res.json();
      setBrief(data);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'Unable to generate brief.');
    } finally {
      setBriefLoading(false);
    }
  }, []);

  // ── Fetch snapshot ───────────────────────────────────────────────────────────
  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/market/snapshot');
      if (res.ok) setSnapshot(await res.json());
    } catch {
      // non-fatal
    } finally {
      setSnapLoading(false);
    }
  }, []);

  // ── Fetch news ───────────────────────────────────────────────────────────────
  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/market/news');
      if (res.ok) setNews(await res.json());
    } catch {
      // non-fatal
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrief();
    fetchSnapshot();
    fetchNews();

    // Auto-refresh news every 5 minutes
    newsIntervalRef.current = setInterval(fetchNews, 5 * 60_000);
    return () => {
      if (newsIntervalRef.current) clearInterval(newsIntervalRef.current);
    };
  }, [fetchBrief, fetchSnapshot, fetchNews]);

  // ── Filtered news ────────────────────────────────────────────────────────────
  const filteredNews = filter === 'all'
    ? news
    : news.filter((item) => item.categories.includes(filter as NewsCategory));

  // ── Brief sections ───────────────────────────────────────────────────────────
  const briefSections = brief ? parseBrief(brief.brief) : [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Markets" />

      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* ── Section 1: AI Daily Brief ───────────────────────────────────── */}
          <div className="border-l-2 border-[#B8960C] border-t border-r border-b border-[#E2E8F0] bg-white">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#E2E8F0]">
              <div>
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#B8960C]">Daily Brief</p>
                {brief && (
                  <p className="mt-0.5 text-[11px] text-[#4A5568]">{briefTimestamp(brief.generated_at)}</p>
                )}
              </div>
              <button
                onClick={fetchBrief}
                disabled={briefLoading}
                className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors disabled:opacity-40"
              >
                {briefLoading ? 'Generating...' : 'Refresh Brief'}
              </button>
            </div>

            <div className="px-6 py-5">
              {briefLoading && !brief && (
                <div className="space-y-3">
                  {[100, 85, 92, 78].map((w, i) => (
                    <div key={i} className={`h-3 animate-pulse bg-[#E2E8F0]`} style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}

              {briefError && !brief && (
                <p className="text-sm text-[#C41E3A]">{briefError}</p>
              )}

              {brief && briefSections.length > 0 && (
                <div className="space-y-5">
                  {briefSections.map(({ heading, body }) => (
                    <div key={heading}>
                      {heading && (
                        <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568] mb-2">{heading}</p>
                      )}
                      <div
                        className="font-serif text-[14px] font-light leading-[1.8] text-[#0A1628] whitespace-pre-line"
                      >
                        {body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Section 2: Market Snapshot ──────────────────────────────────── */}
          <div>
            <p className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568] mb-3">Market Snapshot</p>
            {snapLoading ? (
              <SnapshotSkeleton />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {snapshot.map((tile) => {
                  const positive = tile.change_pct > 0;
                  const negative = tile.change_pct < 0;
                  return (
                    <div key={tile.symbol} className="border border-[#E2E8F0] bg-white p-4">
                      <p className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568]">{tile.label}</p>
                      <p className="mt-2 font-serif text-[22px] font-light leading-none text-[#0A1628]">
                        {fmtPrice(tile.price)}
                      </p>
                      <p className={cn(
                        'mt-1.5 text-xs font-medium',
                        positive ? 'text-green-600' : negative ? 'text-[#C41E3A]' : 'text-[#4A5568]',
                      )}>
                        {fmtChange(tile.change_pct)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Section 3: Intelligence Feed ────────────────────────────────── */}
          <div className="border border-[#E2E8F0] bg-white">
            {/* Header + filter bar */}
            <div className="border-b border-[#E2E8F0] px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif text-lg font-light text-[#0A1628]">Intelligence Feed</h2>
                <button
                  onClick={fetchNews}
                  className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors"
                >
                  Refresh
                </button>
              </div>
              <div className="flex gap-1 flex-wrap">
                {FILTER_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'px-3 py-1 text-[11px] tracking-[0.08em] uppercase transition-colors',
                      filter === key
                        ? 'bg-[#0A1628] text-white'
                        : 'text-[#4A5568] hover:text-[#0A1628]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* News list */}
            {newsLoading ? (
              <NewsSkeleton />
            ) : filteredNews.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="font-serif text-lg font-light text-[#0A1628] mb-1">
                  No market intelligence available.
                </p>
                {filter !== 'all' && (
                  <p className="text-sm text-[#4A5568]">
                    Try switching to "All" or add tickers to your watchlist.
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {filteredNews.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-6 py-5 hover:bg-[#F8F9FA] transition-colors group"
                  >
                    {/* Source + time */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">
                        {item.source}
                      </span>
                      <span className="text-[11px] text-[#4A5568]">{timeAgo(item.published_at)}</span>
                    </div>

                    {/* Headline */}
                    <p className="font-serif text-[14px] font-light leading-snug text-[#0A1628] group-hover:text-[#B8960C] transition-colors mb-1.5">
                      {item.headline}
                    </p>

                    {/* Summary — 2-line clamp */}
                    {item.summary && (
                      <p className="text-[12px] leading-relaxed text-[#4A5568] line-clamp-2 mb-2">
                        {item.summary}
                      </p>
                    )}

                    {/* Symbol badges */}
                    {item.symbols.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.symbols.slice(0, 6).map((sym) => (
                          <span
                            key={sym}
                            className="text-[10px] tracking-[0.08em] uppercase border border-[#E2E8F0] px-1.5 py-0.5 text-[#0A1628]"
                          >
                            {sym}
                          </span>
                        ))}
                        {item.symbols.length > 6 && (
                          <span className="text-[10px] text-[#4A5568]">+{item.symbols.length - 6}</span>
                        )}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
