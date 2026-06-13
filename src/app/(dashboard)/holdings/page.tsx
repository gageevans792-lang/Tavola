'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { HoldingsTable } from '@/components/dashboard/HoldingsTable';
import { Watchlist } from '@/components/dashboard/Watchlist';
import type { SyncedHolding } from '@/lib/alpaca/sync';
import type { SentimentScore } from '@/lib/sentiment/engine';

export default function HoldingsPage() {
  const [holdings, setHoldings]             = useState<SyncedHolding[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [lastSynced, setLastSynced]         = useState<string | null>(null);
  const [source, setSource]                 = useState<'live' | 'simulated' | null>(null);

  const [sentimentScores,  setSentimentScores]  = useState<Record<string, SentimentScore> | undefined>(undefined);
  const [sentimentLoading, setSentimentLoading] = useState(false);

  // ── Fetch positions from the positions API ────────────────────────────────
  const loadPositions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/alpaca/positions');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setHoldings(data.holdings ?? []);
      setSource(data.source ?? null);
      setLastSynced(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holdings. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchSentiment = useCallback(async (tickers: string[]) => {
    if (!tickers.length) return;
    setSentimentLoading(true);
    try {
      const res = await fetch(`/api/market/sentiment?tickers=${tickers.join(',')}`);
      if (res.ok) {
        const scores: SentimentScore[] = await res.json();
        const map: Record<string, SentimentScore> = {};
        for (const s of scores) map[s.ticker] = s;
        setSentimentScores(map);
      }
    } catch { /* non-fatal */ } finally {
      setSentimentLoading(false);
    }
  }, []);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  // Auto-load sentiment after positions load
  useEffect(() => {
    if (!loading && holdings.length > 0) {
      fetchSentiment(holdings.map((h) => h.ticker));
    }
  }, [loading, holdings, fetchSentiment]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Holdings" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-10">

          {/* ── Page header ───────────────────────────────────────────────── */}
          <div className="border-b border-[#E2E8F0] pb-6">
            <h2 className="font-serif text-2xl font-light text-[#0A1628]">Holdings</h2>
            <p className="mt-1 text-sm text-[#4A5568]">Current positions</p>
          </div>

          {/* ── Positions ─────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E2E8F0]">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-light text-[#0A1628]">Positions</h2>
                {loading && (
                  <p className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568] mt-0.5">
                    Loading positions...
                  </p>
                )}
                {!loading && lastSynced && (
                  <p className="text-[11px] text-[#4A5568]/60 mt-0.5">
                    {source === 'live' ? 'Live · ' : ''}Updated {lastSynced}
                    {sentimentLoading && ' · Loading sentiment...'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!loading && holdings.length > 0 && (
                  <button
                    onClick={() => fetchSentiment(holdings.map((h) => h.ticker))}
                    disabled={sentimentLoading}
                    className="text-[11px] tracking-[0.1em] uppercase text-[#B8960C] hover:text-[#9a7d0a] transition-colors disabled:opacity-40"
                  >
                    {sentimentLoading ? 'Loading...' : 'Refresh Sentiment'}
                  </button>
                )}
                <button
                  onClick={() => loadPositions(true)}
                  disabled={loading || refreshing}
                  className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors disabled:opacity-40"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh Positions'}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-6 py-2 border-b border-[#E2E8F0] bg-red-50 border-l-2 border-l-[#991b1b]">
                <p className="text-xs text-[#991b1b]">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="px-6 py-8 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse bg-[#E2E8F0]" />
                ))}
              </div>
            ) : holdings.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] px-8 py-16 text-center">
                <p className="text-[10px] tracking-[0.25em] uppercase text-[#B8960C] mb-4">Empty Portfolio</p>
                <h3 className="font-serif text-[28px] font-light text-[#0A1628] mb-3">
                  Your portfolio is empty.
                </h3>
                <p className="text-[14px] text-[#4A5568] max-w-sm mx-auto mb-8 leading-relaxed">
                  Run an AI analysis to get your first recommendations and start building your portfolio.
                </p>
                <a
                  href="/dashboard"
                  className="inline-block border border-[#0A1628] text-[#0A1628] text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:bg-[#0A1628] hover:text-white transition-colors"
                >
                  Run Analysis
                </a>
              </div>
            ) : (
              <HoldingsTable
                holdings={holdings}
                sentimentScores={sentimentScores}
                sentimentLoading={sentimentLoading}
              />
            )}
          </div>

          {/* ── Watchlist (with typeahead) ────────────────────────────────── */}
          <section>
            <p className="mb-3 text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">Watchlist</p>
            <p className="mb-3 text-xs text-[#4A5568]">Tickers in your watchlist are included in AI analysis.</p>
            <Watchlist />
          </section>

        </div>
      </main>
    </div>
  );
}
