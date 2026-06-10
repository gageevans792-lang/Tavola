'use client';

import { useState, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { FinnhubIPO } from '@/lib/finnhub/client';
import type { IpoAnalysis } from '@/app/api/ai/ipo/route';

function fmtDate(dateStr: string): string {
  if (!dateStr) return '–';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtSharesValue(v: number): string {
  if (!v) return '–';
  if (v >= 1_000_000_000) return '$' + (v / 1_000_000_000).toFixed(1) + 'B';
  if (v >= 1_000_000)     return '$' + (v / 1_000_000).toFixed(0) + 'M';
  return '$' + v.toLocaleString();
}

export default function IpoPage() {
  const [ipos,         setIpos]         = useState<FinnhubIPO[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [analysis,     setAnalysis]     = useState<IpoAnalysis | null>(null);
  const [analyzing,    setAnalyzing]    = useState(false);
  const [alertedSet,   setAlertedSet]   = useState<Set<string>>(new Set());
  const [watchlistSet, setWatchlistSet] = useState<Set<string>>(new Set());
  const [actionMsg,    setActionMsg]    = useState<string | null>(null);

  const fetchIpos = useCallback(async () => {
    try {
      const res = await fetch('/api/ipo');
      if (res.ok) {
        const data = await res.json();
        setIpos(data.ipos ?? []);
      }
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIpos(); }, [fetchIpos]);

  async function runAnalysis() {
    if (analyzing || ipos.length === 0) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/ai/ipo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(ipos),
      });
      if (res.ok) setAnalysis(await res.json());
    } catch { /* non-fatal */ } finally {
      setAnalyzing(false);
    }
  }

  async function setAlert(ipo: FinnhubIPO) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('notifications').insert({
        user_id: user.id,
        type:    'info',
        title:   `IPO Alert: ${ipo.name} (${ipo.symbol})`,
        message: `${ipo.name} is expected to IPO on ${fmtDate(ipo.date)} at ${ipo.price ? '$' + ipo.price : 'TBD'} on ${ipo.exchange}.`,
        ticker:  ipo.symbol || null,
        read:    false,
      });
      setAlertedSet((prev) => new Set(prev).add(ipo.symbol));
      setActionMsg(`Alert set for ${ipo.name} IPO`);
      setTimeout(() => setActionMsg(null), 3000);
    } catch {
      setActionMsg('Failed to set alert');
      setTimeout(() => setActionMsg(null), 3000);
    }
  }

  async function addToWatchlist(ipo: FinnhubIPO) {
    if (!ipo.symbol) return;
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('user_watchlist').insert({ user_id: user.id, ticker: ipo.symbol });
      setWatchlistSet((prev) => new Set(prev).add(ipo.symbol));
      setActionMsg(`${ipo.symbol} added to watchlist`);
      setTimeout(() => setActionMsg(null), 3000);
    } catch {
      setActionMsg('Failed to add to watchlist');
      setTimeout(() => setActionMsg(null), 3000);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="IPO" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
        <div className="mx-auto max-w-7xl divide-y divide-[#E2E8F0]">

          {/* ── Header + AI Analysis ────────────────────────────────────────── */}
          <section className="bg-[#F8F9FA] px-4 sm:px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Upcoming IPOs</p>
                <p className="text-[11px] text-[#4A5568]/60 mt-0.5">Next 30 days · via Finnhub</p>
              </div>
              <button
                onClick={runAnalysis}
                disabled={analyzing || loading || ipos.length === 0}
                className="text-[11px] tracking-[0.15em] uppercase px-5 py-2 bg-[#0A1628] text-white hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? 'Analyzing...' : 'AI IPO Analysis'}
              </button>
            </div>

            {analysis && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#E2E8F0] mb-4">
                <div className="bg-white border-l-2 border-[#166534] px-4 sm:px-5 py-4">
                  <p className="text-[9px] tracking-[0.22em] uppercase text-[#166534] mb-2">Top Picks</p>
                  <p className="font-serif text-[14px] font-light leading-snug text-[#0A1628]">{analysis.top_picks}</p>
                </div>
                <div className="bg-white border-l-2 border-[#991b1b] px-4 sm:px-5 py-4">
                  <p className="text-[9px] tracking-[0.22em] uppercase text-[#991b1b] mb-2">Risks to Avoid</p>
                  <p className="font-serif text-[14px] font-light leading-snug text-[#0A1628]">{analysis.risks_to_avoid}</p>
                </div>
                <div className="bg-white border-l-2 border-[#B8960C] px-4 sm:px-5 py-4">
                  <p className="text-[9px] tracking-[0.22em] uppercase text-[#B8960C] mb-2">Market Appetite</p>
                  <p className="font-serif text-[14px] font-light leading-snug text-[#0A1628]">{analysis.market_appetite}</p>
                  <p className="mt-3 text-[10px] text-[#4A5568]">
                    {new Date(analysis.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ── Toast ──────────────────────────────────────────────────────── */}
          {actionMsg && (
            <div className="bg-[#0A1628] text-white text-[12px] tracking-[0.08em] px-4 sm:px-6 py-2.5">
              {actionMsg}
            </div>
          )}

          {/* ── IPO Table ──────────────────────────────────────────────────── */}
          <section className="bg-white">
            {loading ? (
              <div className="divide-y divide-[#E2E8F0]">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-4 sm:px-6 py-4">
                    <div className="h-4 w-20 animate-pulse bg-[#E2E8F0]" />
                    <div className="flex-1 h-4 animate-pulse bg-[#E2E8F0]" />
                    <div className="h-4 w-16 animate-pulse bg-[#E2E8F0]" />
                  </div>
                ))}
              </div>
            ) : ipos.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#B8960C] mb-3">No Scheduled IPOs</p>
                <p className="text-sm text-[#4A5568]">No IPOs found in the next 30 days. Check back later.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] sm:text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA]">
                      <th className="text-left px-4 sm:px-6 py-3 text-[9px] tracking-[0.18em] uppercase text-[#4A5568] font-normal whitespace-nowrap">Company</th>
                      <th className="text-left px-4 sm:px-6 py-3 text-[9px] tracking-[0.18em] uppercase text-[#4A5568] font-normal hidden sm:table-cell whitespace-nowrap">Ticker</th>
                      <th className="text-left px-4 sm:px-6 py-3 text-[9px] tracking-[0.18em] uppercase text-[#4A5568] font-normal hidden md:table-cell whitespace-nowrap">Exchange</th>
                      <th className="text-left px-4 sm:px-6 py-3 text-[9px] tracking-[0.18em] uppercase text-[#4A5568] font-normal whitespace-nowrap">Date</th>
                      <th className="text-left px-4 sm:px-6 py-3 text-[9px] tracking-[0.18em] uppercase text-[#4A5568] font-normal hidden lg:table-cell whitespace-nowrap">Price Range</th>
                      <th className="text-right px-4 sm:px-6 py-3 text-[9px] tracking-[0.18em] uppercase text-[#4A5568] font-normal hidden lg:table-cell whitespace-nowrap">Deal Size</th>
                      <th className="text-right px-4 sm:px-6 py-3 text-[9px] tracking-[0.18em] uppercase text-[#4A5568] font-normal whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {ipos.map((ipo, i) => (
                      <tr key={`${ipo.symbol}-${i}`} className="hover:bg-[#F8F9FA] transition-colors">
                        <td className="px-4 sm:px-6 py-4">
                          <p className="font-medium text-[#0A1628] truncate max-w-[160px] sm:max-w-xs">{ipo.name || '–'}</p>
                          <p className={cn(
                            'text-[9px] tracking-[0.1em] uppercase mt-0.5',
                            ipo.status === 'expected' ? 'text-[#166534]' : 'text-[#4A5568]',
                          )}>
                            {ipo.status || 'pending'}
                          </p>
                        </td>
                        <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                          <span className="font-mono font-bold text-[#0A1628] text-xs">
                            {ipo.symbol || '–'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-[#4A5568] hidden md:table-cell">
                          {ipo.exchange || '–'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-[#0A1628] whitespace-nowrap">
                          {fmtDate(ipo.date)}
                        </td>
                        <td className="px-4 sm:px-6 py-4 font-mono text-[#0A1628] hidden lg:table-cell">
                          {ipo.price ? `$${ipo.price}` : '–'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-right font-mono text-[#0A1628] hidden lg:table-cell">
                          {fmtSharesValue(ipo.totalSharesValue)}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setAlert(ipo)}
                              disabled={alertedSet.has(ipo.symbol)}
                              className={cn(
                                'text-[9px] tracking-[0.12em] uppercase px-2 py-1 border transition-colors whitespace-nowrap',
                                alertedSet.has(ipo.symbol)
                                  ? 'border-[#166534] text-[#166534] cursor-default'
                                  : 'border-[#E2E8F0] text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628]',
                              )}
                            >
                              {alertedSet.has(ipo.symbol) ? 'Alerted' : 'Set Alert'}
                            </button>
                            {ipo.symbol && (
                              <button
                                onClick={() => addToWatchlist(ipo)}
                                disabled={watchlistSet.has(ipo.symbol)}
                                className={cn(
                                  'text-[9px] tracking-[0.12em] uppercase px-2 py-1 border transition-colors whitespace-nowrap',
                                  watchlistSet.has(ipo.symbol)
                                    ? 'border-[#B8960C] text-[#B8960C] cursor-default'
                                    : 'border-[#E2E8F0] text-[#4A5568] hover:border-[#B8960C] hover:text-[#B8960C]',
                                )}
                              >
                                {watchlistSet.has(ipo.symbol) ? 'Watching' : 'Watchlist'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
