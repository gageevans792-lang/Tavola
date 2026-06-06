'use client';

import { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { Holding } from '@/types';

interface WatchlistItem {
  id: string;
  ticker: string;
}

export default function HoldingsPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [tickerInput, setTickerInput] = useState('');
  const [loadingHoldings, setLoadingHoldings] = useState(true);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHoldings();
    loadWatchlist();
  }, []);

  async function loadHoldings() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', user.id)
        .order('market_value', { ascending: false });
      if (error) throw error;
      setHoldings(data ?? []);
    } catch (err) {
      console.error('[holdings] failed to load', err);
    } finally {
      setLoadingHoldings(false);
    }
  }

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
    } catch (err) {
      console.error('[holdings] failed to add ticker', err);
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
    } catch (err) {
      console.error('[holdings] failed to remove ticker', err);
      setError(`Unable to remove ${ticker}. Please try again.`);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Holdings" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Positions */}
          <div className="bg-white border border-[#E2E8F0]">
            <div className="px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="font-serif text-lg font-light text-[#0A1628]">Positions</h2>
            </div>
            {loadingHoldings ? (
              <div className="px-6 py-8 text-center text-sm text-[#4A5568]">Loading...</div>
            ) : holdings.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="font-serif text-lg font-light text-[#0A1628] mb-1">No positions yet.</p>
                <p className="text-sm text-[#4A5568]">Run an AI analysis to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      {['Ticker', 'Shares', 'Avg Price', 'Current', 'Mkt Value', 'P&L', 'Weight'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-[11px] tracking-[0.1em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => (
                      <tr key={h.ticker} className="border-b border-[#E2E8F0] hover:bg-[#F8F9FA]">
                        <td className="px-6 py-4">
                          <p className="font-medium text-[#0A1628]">{h.ticker}</p>
                          {h.name && <p className="text-xs text-[#4A5568]">{h.name}</p>}
                        </td>
                        <td className="px-6 py-4 text-[#4A5568]">{h.qty}</td>
                        <td className="px-6 py-4 text-[#4A5568]">${h.avg_entry_price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-[#4A5568]">${h.current_price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-[#0A1628]">${h.market_value.toLocaleString()}</td>
                        <td className={cn('px-6 py-4 font-medium', h.unrealized_pl >= 0 ? 'text-green-600' : 'text-[#C41E3A]')}>
                          {h.unrealized_pl >= 0 ? '+' : ''}${h.unrealized_pl.toFixed(2)}
                          <span className="ml-1 text-xs opacity-70">
                            ({(h.unrealized_plpc * 100).toFixed(1)}%)
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[#4A5568]">{h.weight_pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Watchlist */}
          <div className="bg-white border border-[#E2E8F0]">
            <div className="px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="font-serif text-lg font-light text-[#0A1628]">Watchlist</h2>
              <p className="text-xs text-[#4A5568] mt-0.5">Tickers in your watchlist are included in AI analysis.</p>
            </div>

            <div className="px-6 py-4 border-b border-[#E2E8F0]">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-1">
                    Ticker symbol
                  </label>
                  <input
                    type="text"
                    value={tickerInput}
                    onChange={(e) => {
                      setError(null);
                      setTickerInput(e.target.value.toUpperCase());
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="AAPL"
                    maxLength={10}
                    className="w-full border-b border-[#E2E8F0] py-2 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent placeholder:text-[#0A1628]/25 transition-colors"
                  />
                </div>
                <button
                  onClick={handleAdd}
                  disabled={adding || !tickerInput.trim()}
                  className="bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase px-6 h-10 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {adding ? 'Adding...' : 'Add'}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-[#C41E3A]">{error}</p>}
            </div>

            {loadingWatchlist ? (
              <div className="px-6 py-8 text-center text-sm text-[#4A5568]">Loading...</div>
            ) : watchlist.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-[#4A5568]">Add tickers to your watchlist to enable AI analysis.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {watchlist.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-6 py-3">
                    <span className="font-medium text-sm text-[#0A1628]">{item.ticker}</span>
                    <button
                      onClick={() => handleRemove(item.id, item.ticker)}
                      className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568]/50 hover:text-[#C41E3A] transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
