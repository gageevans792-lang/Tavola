'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { HoldingsTable } from '@/components/dashboard/HoldingsTable';
import { createClient } from '@/lib/supabase/client';
import type { SyncedHolding } from '@/lib/alpaca/sync';
import type { PortfolioData } from '@/app/api/alpaca/portfolio/route';

interface WatchlistItem {
  id: string;
  ticker: string;
}

export default function HoldingsPage() {
  const [holdings, setHoldings]     = useState<SyncedHolding[]>([]);
  const [syncing, setSyncing]       = useState(true);
  const [watchlist, setWatchlist]   = useState<WatchlistItem[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [tickerInput, setTickerInput] = useState('');
  const [adding, setAdding]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // ── Sync positions from Alpaca then read fresh holdings ───────────────────
  const syncAndLoad = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/alpaca/portfolio');
      if (res.ok) {
        const data: PortfolioData = await res.json();
        setHoldings(data.holdings);
        return;
      }
    } catch (err) {
      console.warn('[holdings] portfolio sync failed:', err);
    }

    // Fallback: read directly from Supabase if API call fails
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('holdings')
          .select('*')
          .eq('user_id', user.id)
          .order('market_value', { ascending: false });
        setHoldings((data ?? []) as SyncedHolding[]);
      }
    } catch (err) {
      console.error('[holdings] fallback fetch failed:', err);
    } finally {
      setSyncing(false);
    }
    setSyncing(false);
  }, []);

  useEffect(() => {
    syncAndLoad();
    loadWatchlist();
  }, [syncAndLoad]);

  async function loadWatchlist() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('user_watchlist')
        .select('id, ticker')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setWatchlist(data ?? []);
    } catch (err) {
      console.error('[holdings] failed to load watchlist', err);
    } finally {
      setLoadingWatchlist(false);
    }
  }

  async function handleAdd() {
    const ticker = tickerInput.trim().toUpperCase();
    if (!ticker) return;
    if (watchlist.some((w) => w.ticker === ticker)) {
      setError(`${ticker} is already in your watchlist.`);
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('user_watchlist')
        .insert({ user_id: user.id, ticker })
        .select('id, ticker')
        .single();
      if (error) throw error;
      setWatchlist((prev) => [...prev, data]);
      setTickerInput('');
    } catch {
      setError('Unable to add ticker. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string, ticker: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase.from('user_watchlist').delete().eq('id', id);
      if (error) throw error;
      setWatchlist((prev) => prev.filter((w) => w.id !== id));
    } catch {
      setError(`Unable to remove ${ticker}. Please try again.`);
    }
  }

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
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">Positions</p>
              {!syncing && (
                <button
                  onClick={syncAndLoad}
                  className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors"
                >
                  Refresh
                </button>
              )}
              {syncing && (
                <span className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568]">Syncing...</span>
              )}
            </div>
            <div className="bg-white border border-[#E2E8F0]">
              {syncing ? (
                <div className="px-6 py-8 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 animate-pulse bg-[#E2E8F0]" />
                  ))}
                </div>
              ) : (
                <HoldingsTable holdings={holdings} />
              )}
            </div>
          </section>

          {/* ── Watchlist ─────────────────────────────────────────────────── */}
          <section>
            <p className="mb-3 text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">Watchlist</p>
            <div className="bg-white border border-[#E2E8F0]">
              <div className="px-6 py-4 border-b border-[#E2E8F0]">
                <p className="text-xs text-[#4A5568]">Tickers in your watchlist are included in AI analysis.</p>
              </div>

              <div className="px-6 py-5 border-b border-[#E2E8F0]">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-2">
                      Ticker symbol
                    </label>
                    <input
                      type="text"
                      value={tickerInput}
                      onChange={(e) => { setError(null); setTickerInput(e.target.value.toUpperCase()); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                      placeholder="AAPL"
                      maxLength={10}
                      className="w-full border-b border-[#E2E8F0] py-2 font-mono text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent placeholder:text-[#0A1628]/25 transition-colors tracking-wide"
                    />
                  </div>
                  <button
                    onClick={handleAdd}
                    disabled={adding || !tickerInput.trim()}
                    className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase px-6 h-9 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {adding ? 'Adding' : 'Add'}
                  </button>
                </div>
                {error && <p className="mt-2 text-[11px] text-[#C41E3A]">{error}</p>}
              </div>

              {loadingWatchlist ? (
                <div className="px-6 py-8 space-y-2">
                  <div className="h-8 w-1/3 animate-pulse bg-[#E2E8F0]" />
                  <div className="h-8 w-1/4 animate-pulse bg-[#E2E8F0]" />
                </div>
              ) : watchlist.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-[#4A5568]">Add tickers to your watchlist to enable AI analysis.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {watchlist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-6 py-3">
                      <span className="font-mono text-xs font-bold text-[#0A1628] tracking-wide">{item.ticker}</span>
                      <button
                        onClick={() => handleRemove(item.id, item.ticker)}
                        className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568]/50 hover:text-[#C41E3A] transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
