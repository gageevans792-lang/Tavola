'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import type { Trade } from '@/app/api/trades/route';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'buys' | 'sells' | 'pending' | 'completed' | 'failed';

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All',       value: 'all'       },
  { label: 'Buys',      value: 'buys'      },
  { label: 'Sells',     value: 'sells'     },
  { label: 'Pending',   value: 'pending'   },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed',    value: 'failed'    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ', '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtPrice(price: number | null): string {
  if (price == null) return '–';
  return '$' + price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtTotal(qty: number, price: number | null): string {
  if (price == null) return '–';
  const total = qty * price;
  return '$' + total.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function tradeSource(trade: Trade): string {
  if (
    trade.ai_reasoning?.includes('autopilot') ||
    trade.ai_reasoning?.includes('AutoPilot')
  ) {
    return 'AI AutoPilot';
  }
  if (trade.ai_reasoning) return 'AI Agent';
  return 'Manual';
}

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'filled') return 'Completed';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'filled' || s === 'completed') return 'text-[#166534]';
  if (s === 'pending')                     return 'text-[#B8960C]';
  if (s === 'cancelled' || s === 'failed') return 'text-[#991b1b]';
  return 'text-[#4A5568]';
}

function applyFilter(trades: Trade[], filter: FilterTab): Trade[] {
  switch (filter) {
    case 'buys':     return trades.filter((t) => t.side === 'buy');
    case 'sells':    return trades.filter((t) => t.side === 'sell');
    case 'pending':  return trades.filter((t) => t.status.toLowerCase() === 'pending');
    case 'completed':return trades.filter((t) => ['filled', 'completed'].includes(t.status.toLowerCase()));
    case 'failed':   return trades.filter((t) => ['cancelled', 'failed'].includes(t.status.toLowerCase()));
    default:         return trades;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">
      {children}
    </p>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TradesPage() {
  const [trades,    setTrades]    = useState<Trade[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset,    setOffset]    = useState(0);
  const [filter,    setFilter]    = useState<FilterTab>('all');
  const [error,     setError]     = useState<string | null>(null);

  const PAGE_SIZE = 50;

  const fetchTrades = useCallback(async (off: number, replace: boolean) => {
    if (replace) setLoading(true); else setLoadingMore(true);
    try {
      const res  = await fetch(`/api/trades?limit=${PAGE_SIZE}&offset=${off}`);
      const json = await res.json();
      const fetched: Trade[] = json.trades ?? [];
      const tot: number      = json.total  ?? 0;

      setTrades((prev) => replace ? fetched : [...prev, ...fetched]);
      setTotal(tot);
      setOffset(off + fetched.length);
    } catch (err) {
      console.error('[trades page] fetch error:', err);
      setError('Failed to load trades. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchTrades(0, true); }, [fetchTrades]);

  function handleLoadMore() {
    fetchTrades(offset, false);
  }

  const filtered = useMemo(() => applyFilter(trades, filter), [trades, filter]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const buyCount  = trades.filter((t) => t.side === 'buy').length;
  const sellCount = trades.filter((t) => t.side === 'sell').length;

  const mostTraded = useMemo(() => {
    if (trades.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const t of trades) counts[t.ticker] = (counts[t.ticker] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [trades]);

  const hasMore = offset < total;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Trade History" />

      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-5">

          {/* Summary stats bar */}
          {!loading && trades.length > 0 && (
            <div className="border border-[#E2E8F0] bg-white flex items-stretch divide-x divide-[#E2E8F0] overflow-x-auto">
              <div className="w-0.5 shrink-0 bg-[#B8960C]" />
              <div className="flex flex-col justify-center px-5 py-3">
                <SectionLabel>Total Trades</SectionLabel>
                <p className="mt-0.5 font-mono text-lg font-medium text-[#0A1628] tabular-nums">
                  {total}
                </p>
              </div>
              <div className="flex flex-col justify-center px-5 py-3">
                <SectionLabel>Buy / Sell</SectionLabel>
                <p className="mt-0.5 font-mono text-lg font-medium text-[#0A1628] tabular-nums">
                  {buyCount} / {sellCount}
                </p>
              </div>
              {mostTraded && (
                <div className="flex flex-col justify-center px-5 py-3">
                  <SectionLabel>Most Traded</SectionLabel>
                  <p className="mt-0.5 font-mono text-lg font-medium text-[#0A1628] tabular-nums uppercase">
                    {mostTraded}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {FILTER_TABS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`
                  shrink-0 px-4 py-2 text-sm transition-colors border-b-2
                  ${filter === value
                    ? 'border-[#B8960C] text-[#0A1628] font-medium'
                    : 'border-transparent text-[#4A5568] hover:text-[#0A1628]'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-[#991b1b]">{error}</p>
              <button
                type="button"
                onClick={() => fetchTrades(0, true)}
                className="text-[11px] tracking-[0.1em] uppercase text-[#991b1b] border border-[#991b1b]/30 px-3 py-1 hover:bg-[#991b1b]/5 transition-colors ml-4 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Trades table */}
          <div className="border border-[#E2E8F0] bg-white overflow-x-auto">

            {/* Header */}
            <div className="hidden md:grid grid-cols-8 border-b border-[#E2E8F0] px-4 py-2.5 bg-[#F8F9FA]">
              {['Date / Time', 'Symbol', 'Action', 'Qty', 'Price', 'Total', 'Status', 'Source'].map((h) => (
                <span key={h} className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">
                  {h}
                </span>
              ))}
            </div>

            {loading ? (
              <div className="px-4 py-6 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="grid grid-cols-8 gap-x-2 py-3 border-b border-[#E2E8F0]">
                    {[40, 16, 12, 8, 16, 16, 16, 14].map((w, j) => (
                      <div key={j} className={`h-4 animate-pulse bg-[#E2E8F0] rounded w-${w}`} />
                    ))}
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-12 text-center">
                {trades.length === 0 ? (
                  <>
                    <p className="font-serif text-lg font-light text-[#0A1628] mb-2">
                      No trades yet
                    </p>
                    <p className="text-sm text-[#4A5568] max-w-sm mx-auto mb-6">
                      Your trade history will appear here once AutoPilot executes its first order or you place a manual trade.
                    </p>
                    <Link
                      href="/autopilot"
                      className="inline-block border border-[#0A1628] px-6 py-2.5 text-[11px] tracking-[0.12em] uppercase text-[#0A1628] hover:bg-[#0A1628] hover:text-white transition-colors"
                    >
                      Configure AutoPilot
                    </Link>
                  </>
                ) : (
                  <p className="font-serif text-lg font-light text-[#0A1628] mb-2">
                    No trades match this filter.
                  </p>
                )}
              </div>
            ) : (
              filtered.map((trade) => (
                <div
                  key={trade.id}
                  className="grid grid-cols-2 md:grid-cols-8 items-center gap-x-2 border-b border-[#E2E8F0] px-4 py-3 last:border-b-0 hover:bg-[#F8F9FA] transition-colors"
                >
                  {/* Date */}
                  <span className="text-xs text-[#4A5568] col-span-2 md:col-span-1">
                    {fmtDateTime(trade.created_at)}
                  </span>

                  {/* Symbol */}
                  <span className="font-mono text-sm font-bold uppercase text-[#0A1628]">
                    {trade.ticker}
                  </span>

                  {/* Action badge */}
                  <span>
                    {trade.side === 'buy' ? (
                      <span className="inline-block bg-[#166534] px-2 py-0.5 text-[11px] font-medium tracking-wider text-white uppercase">
                        BUY
                      </span>
                    ) : (
                      <span className="inline-block bg-[#991b1b] px-2 py-0.5 text-[11px] font-medium tracking-wider text-white uppercase">
                        SELL
                      </span>
                    )}
                  </span>

                  {/* Qty */}
                  <span className="font-mono text-sm text-[#0A1628] tabular-nums">
                    {trade.qty}
                  </span>

                  {/* Price */}
                  <span className="font-mono text-sm text-[#0A1628] tabular-nums">
                    {fmtPrice(trade.price)}
                  </span>

                  {/* Total */}
                  <span className="font-mono text-sm text-[#0A1628] tabular-nums">
                    {fmtTotal(trade.qty, trade.price)}
                  </span>

                  {/* Status */}
                  <span className={`text-xs ${statusColor(trade.status)}`}>
                    {statusLabel(trade.status)}
                  </span>

                  {/* Source */}
                  <span className="text-xs text-[#4A5568]">
                    {tradeSource(trade)}
                  </span>
                </div>
              ))
            )}

          </div>

          {/* Load more */}
          {!loading && hasMore && (
            <div className="text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="border border-[#E2E8F0] bg-white px-8 py-2.5 text-sm text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628] transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
