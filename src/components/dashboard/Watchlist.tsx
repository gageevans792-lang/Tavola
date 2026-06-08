'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WatchlistEntry {
  id:     string;
  ticker: string;
}

interface TickerData {
  price:     number;
  change:    number;
  changePct: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/;

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Watchlist() {
  const [entries, setEntries]     = useState<WatchlistEntry[]>([]);
  const [prices, setPrices]       = useState<Record<string, TickerData>>({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [input, setInput]         = useState('');
  const [adding, setAdding]       = useState(false);
  const [addError, setAddError]   = useState<string | null>(null);
  const [removing, setRemoving]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load watchlist from Supabase ──────────────────────────────────────────
  const loadWatchlist = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error: dbErr } = await supabase
        .from('user_watchlist')
        .select('id, ticker')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (dbErr) throw dbErr;
      setEntries(data ?? []);
      setError(null);
    } catch (err) {
      setError('Could not load watchlist.');
      console.error('[watchlist] load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch live prices from movers endpoint ────────────────────────────────
  const refreshPrices = useCallback(async () => {
    if (entries.length === 0) return;
    try {
      const res = await fetch('/api/market/movers');
      if (!res.ok) return;
      const data = await res.json();
      const all: Array<{ symbol: string; price: number; change: number; changePct: number }> = [
        ...(data.gainers ?? []),
        ...(data.losers  ?? []),
      ];
      const map: Record<string, TickerData> = {};
      for (const m of all) {
        map[m.symbol] = { price: m.price, change: m.change, changePct: m.changePct };
      }
      setPrices(map);
    } catch {
      // prices are non-critical — silently ignore
    }
  }, [entries]);

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);
  useEffect(() => {
    refreshPrices();
    const id = setInterval(refreshPrices, 60_000);
    return () => clearInterval(id);
  }, [refreshPrices]);

  // ── Add ticker ────────────────────────────────────────────────────────────
  async function handleAdd() {
    const ticker = input.trim().toUpperCase();
    setAddError(null);

    if (!TICKER_RE.test(ticker)) {
      setAddError('Invalid ticker format.');
      return;
    }
    if (entries.some((e) => e.ticker === ticker)) {
      setAddError('Already on watchlist.');
      return;
    }

    setAdding(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: dbErr } = await supabase
        .from('user_watchlist')
        .insert({ user_id: user.id, ticker })
        .select('id, ticker')
        .single();

      if (dbErr) throw dbErr;
      setEntries((prev) => [...prev, data]);
      setInput('');
      inputRef.current?.focus();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add ticker.');
    } finally {
      setAdding(false);
    }
  }

  // ── Remove ticker ─────────────────────────────────────────────────────────
  async function handleRemove(id: string, ticker: string) {
    setRemoving(id);
    try {
      const supabase = createClient();
      const { error: dbErr } = await supabase
        .from('user_watchlist')
        .delete()
        .eq('id', id);

      if (dbErr) throw dbErr;
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setPrices((prev) => {
        const next = { ...prev };
        delete next[ticker];
        return next;
      });
    } catch (err) {
      console.error('[watchlist] remove:', err);
    } finally {
      setRemoving(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="border border-[#E2E8F0] bg-white p-4">

      {/* Header */}
      <p className="mb-4 text-[11px] tracking-[0.15em] uppercase text-[#4A5568]">Watchlist</p>

      {error && (
        <p className="mb-3 text-xs text-red-500">{error}</p>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2 py-1.5">
              <div className="h-3.5 w-12 animate-pulse bg-[#E2E8F0]" />
              <div className="ml-auto h-3.5 w-16 animate-pulse bg-[#E2E8F0]" />
              <div className="h-3.5 w-12 animate-pulse bg-[#E2E8F0]" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="mb-3 text-xs text-[#4A5568]">No tickers on your watchlist yet.</p>
      ) : (
        <div className="mb-3">
          {entries.map((entry) => {
            const ticker = entry.ticker;
            const data   = prices[ticker];
            const positive = data ? data.changePct >= 0 : null;

            return (
              <div
                key={entry.id}
                className="flex items-center gap-2 border-b border-[#E2E8F0] py-1.5 last:border-0"
              >
                <span className="w-14 font-mono text-xs font-bold text-[#0A1628]">
                  {ticker}
                </span>

                {data ? (
                  <>
                    <span className="ml-auto font-mono text-xs tabular-nums text-[#0A1628]">
                      ${fmtPrice(data.price)}
                    </span>
                    <span
                      className={cn(
                        'w-16 text-right font-mono text-xs font-medium tabular-nums',
                        positive ? 'text-green-600' : 'text-red-500',
                      )}
                    >
                      {fmtPct(data.changePct)}
                    </span>
                  </>
                ) : (
                  <span className="ml-auto text-xs text-[#4A5568]/60">—</span>
                )}

                <button
                  onClick={() => handleRemove(entry.id, ticker)}
                  disabled={removing === entry.id}
                  className="ml-1 text-[#4A5568]/40 hover:text-red-500 transition-colors text-xs leading-none"
                  aria-label={`Remove ${ticker}`}
                >
                  {removing === entry.id ? '...' : 'x'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add ticker input */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value.toUpperCase()); setAddError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="Add ticker..."
          maxLength={6}
          className="flex-1 border border-[#E2E8F0] bg-white px-2 py-1.5 font-mono text-xs text-[#0A1628] placeholder:text-[#4A5568]/50 focus:border-[#0A1628] focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="border border-[#0A1628] px-3 py-1.5 text-[10px] tracking-[0.12em] uppercase text-[#0A1628] hover:bg-[#0A1628] hover:text-white transition-colors disabled:opacity-40"
        >
          {adding ? '...' : 'Add'}
        </button>
      </div>

      {addError && (
        <p className="mt-1 text-[10px] text-red-500">{addError}</p>
      )}
    </div>
  );
}
