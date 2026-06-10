'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import type { CryptoBar } from '@/lib/alpaca/client';

interface CryptoAnalysis {
  market_regime:   string;
  top_opportunity: string;
  risk_warning:    string;
  generated_at:    string;
}

const CRYPTO_NAMES: Record<string, string> = {
  'BTC/USD':  'Bitcoin',
  'ETH/USD':  'Ethereum',
  'SOL/USD':  'Solana',
  'DOGE/USD': 'Dogecoin',
  'AVAX/USD': 'Avalanche',
  'LINK/USD': 'Chainlink',
  'UNI/USD':  'Uniswap',
  'AAVE/USD': 'Aave',
  'LTC/USD':  'Litecoin',
  'XRP/USD':  'XRP',
  'MATIC/USD': 'Polygon',
  'DOT/USD':  'Polkadot',
};

// Symbols shown as primary tiles (top 6)
const TILE_SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'DOGE/USD', 'AVAX/USD', 'LINK/USD'];

function fmtPrice(n: number): string {
  if (!n) return '–';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1)    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return '$' + n.toFixed(6);
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

type AlpacaPosition = { symbol: string; qty: string; market_value: string; unrealized_pl: string; unrealized_plpc: string; current_price: string };

export default function CryptoPage() {
  const [prices,     setPrices]     = useState<CryptoBar[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [analysis,   setAnalysis]   = useState<CryptoAnalysis | null>(null);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Trade form
  const [tradeSymbol,  setTradeSymbol]  = useState('BTC/USD');
  const [tradeSide,    setTradeSide]    = useState<'buy' | 'sell'>('buy');
  const [tradeAmount,  setTradeAmount]  = useState('');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeMsg,     setTradeMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  // Crypto positions
  const [positions,      setPositions]      = useState<AlpacaPosition[]>([]);
  const [positionsLoaded, setPositionsLoaded] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/crypto');
      if (res.ok) {
        const data: CryptoBar[] = await res.json();
        setPrices(data);
        setLastRefresh(new Date());
      }
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch('/api/alpaca/portfolio');
      if (!res.ok) return;
      const data = await res.json();
      const cryptoPos = (data.positions ?? []).filter(
        (p: AlpacaPosition) => p.symbol.includes('/'),
      );
      setPositions(cryptoPos);
    } catch { /* non-fatal */ } finally {
      setPositionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    fetchPositions();
    intervalRef.current = setInterval(fetchPrices, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchPrices, fetchPositions]);

  const priceMap: Record<string, CryptoBar> = {};
  for (const p of prices) priceMap[p.symbol] = p;

  const tilePrices = TILE_SYMBOLS.map((s) => priceMap[s]).filter(Boolean);

  async function runAnalysis() {
    if (analyzing || prices.length === 0) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/ai/crypto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prices) });
      if (res.ok) setAnalysis(await res.json());
    } catch { /* non-fatal */ } finally {
      setAnalyzing(false);
    }
  }

  async function handleTrade() {
    const amt = parseFloat(tradeAmount);
    if (!amt || amt < 1) { setTradeMsg({ text: 'Enter a valid USD amount (min $1)', ok: false }); return; }
    setTradeLoading(true);
    setTradeMsg(null);
    try {
      const res = await fetch('/api/crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: tradeSymbol, side: tradeSide, notional: amt }),
      });
      const data = await res.json();
      if (res.ok) {
        setTradeMsg({ text: `Order placed: ${tradeSide.toUpperCase()} $${amt} ${tradeSymbol}`, ok: true });
        setTradeAmount('');
        setTimeout(fetchPositions, 3000);
      } else {
        setTradeMsg({ text: data.error ?? 'Order failed', ok: false });
      }
    } catch {
      setTradeMsg({ text: 'Order failed. Please try again.', ok: false });
    } finally {
      setTradeLoading(false);
    }
  }

  const currentPrice = priceMap[tradeSymbol]?.price ?? 0;
  const estimatedUnits = tradeAmount && currentPrice > 0
    ? (parseFloat(tradeAmount) / currentPrice).toFixed(6)
    : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Crypto" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
        <div className="mx-auto max-w-7xl divide-y divide-[#E2E8F0]">

          {/* ── S1: Crypto Prices ──────────────────────────────────────────── */}
          <section className="bg-white">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#E2E8F0]">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Live Prices</p>
              <div className="flex items-center gap-3">
                {lastRefresh && (
                  <span className="text-[10px] text-[#4A5568]/60">
                    Updated {fmtTime(lastRefresh.toISOString())}
                  </span>
                )}
                <button
                  onClick={fetchPrices}
                  className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[#E2E8F0]">
                {[1,2,3,4,5,6].map((i) => (
                  <div key={i} className="bg-white px-4 py-5 space-y-2">
                    <div className="h-2.5 w-16 animate-pulse bg-[#E2E8F0]" />
                    <div className="h-6   w-28 animate-pulse bg-[#E2E8F0]" />
                    <div className="h-3   w-14 animate-pulse bg-[#E2E8F0]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[#E2E8F0]">
                {tilePrices.map((p) => {
                  const pos = p.change_pct_24h > 0;
                  const neg = p.change_pct_24h < 0;
                  return (
                    <div key={p.symbol} className="bg-white px-4 py-5">
                      <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568]">
                        {p.symbol.replace('/USD', '')}
                      </p>
                      <p className="text-[10px] text-[#4A5568]/50 mb-1.5">
                        {CRYPTO_NAMES[p.symbol] ?? p.symbol}
                      </p>
                      <p className="font-serif text-[20px] sm:text-[22px] font-light leading-none text-[#0A1628]">
                        {fmtPrice(p.price)}
                      </p>
                      <p className={cn(
                        'mt-1 text-[13px] font-medium',
                        pos ? 'text-[#166534]' : neg ? 'text-[#991b1b]' : 'text-[#4A5568]',
                      )}>
                        {pos ? '▲' : neg ? '▼' : ''} {p.price > 0 ? fmtPct(p.change_pct_24h) : '–'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* All prices table */}
            {!loading && prices.length > 0 && (
              <div className="border-t border-[#E2E8F0] overflow-x-auto">
                <table className="w-full text-[12px] sm:text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="text-left px-4 sm:px-6 py-2.5 text-[9px] tracking-[0.18em] uppercase text-[#4A5568] font-normal">Asset</th>
                      <th className="text-right px-4 sm:px-6 py-2.5 text-[9px] tracking-[0.18em] uppercase text-[#4A5568] font-normal">Price</th>
                      <th className="text-right px-4 sm:px-6 py-2.5 text-[9px] tracking-[0.18em] uppercase text-[#4A5568] font-normal">24h Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {prices.filter((p) => p.price > 0).map((p) => {
                      const pos = p.change_pct_24h > 0;
                      const neg = p.change_pct_24h < 0;
                      return (
                        <tr key={p.symbol} className="hover:bg-[#F8F9FA] transition-colors">
                          <td className="px-4 sm:px-6 py-3">
                            <span className="font-mono font-bold text-[#0A1628] mr-2">
                              {p.symbol.replace('/USD', '')}
                            </span>
                            <span className="text-[#4A5568] hidden sm:inline">{CRYPTO_NAMES[p.symbol]}</span>
                          </td>
                          <td className="px-4 sm:px-6 py-3 text-right font-mono text-[#0A1628] tabular-nums">
                            {fmtPrice(p.price)}
                          </td>
                          <td className={cn(
                            'px-4 sm:px-6 py-3 text-right font-mono tabular-nums',
                            pos ? 'text-[#166534]' : neg ? 'text-[#991b1b]' : 'text-[#4A5568]',
                          )}>
                            {fmtPct(p.change_pct_24h)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── S2: AI Crypto Analysis ─────────────────────────────────────── */}
          <section className="bg-[#F8F9FA] px-4 sm:px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">AI Crypto Analysis</p>
              <button
                onClick={runAnalysis}
                disabled={analyzing || loading || prices.length === 0}
                className="text-[11px] tracking-[0.15em] uppercase px-5 py-2 bg-[#0A1628] text-white hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? 'Analyzing...' : 'Get AI Analysis'}
              </button>
            </div>

            {analysis ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#E2E8F0]">
                <div className="bg-white border-l-2 border-[#B8960C] px-4 sm:px-5 py-4">
                  <p className="text-[9px] tracking-[0.22em] uppercase text-[#B8960C] mb-2">Market Regime</p>
                  <p className="font-serif text-[14px] sm:text-[15px] font-light leading-snug text-[#0A1628]">
                    {analysis.market_regime}
                  </p>
                  <p className="mt-3 text-[10px] text-[#4A5568]">{fmtTime(analysis.generated_at)}</p>
                </div>
                <div className="bg-white border-l-2 border-[#166534] px-4 sm:px-5 py-4">
                  <p className="text-[9px] tracking-[0.22em] uppercase text-[#166534] mb-2">Top Opportunity</p>
                  <p className="font-serif text-[14px] sm:text-[15px] font-light leading-snug text-[#0A1628]">
                    {analysis.top_opportunity}
                  </p>
                </div>
                <div className="bg-white border-l-2 border-[#991b1b] px-4 sm:px-5 py-4">
                  <p className="text-[9px] tracking-[0.22em] uppercase text-[#991b1b] mb-2">Risk Warning</p>
                  <p className="font-serif text-[14px] sm:text-[15px] font-light leading-snug text-[#0A1628]">
                    {analysis.risk_warning}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#E2E8F0] px-6 py-10 text-center">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#B8960C] mb-2">AI-Powered</p>
                <p className="font-serif text-[18px] font-light text-[#0A1628] mb-1">Institutional Crypto Intelligence</p>
                <p className="text-sm text-[#4A5568]">Click &quot;Get AI Analysis&quot; for real-time market regime, top opportunity, and risk assessment.</p>
              </div>
            )}
          </section>

          {/* ── S3 + S4: Trade + Holdings ──────────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F0]">

            {/* Trade Crypto */}
            <div className="bg-white">
              <div className="px-4 sm:px-6 py-3 border-b border-[#E2E8F0]">
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Trade Crypto</p>
              </div>
              <div className="px-4 sm:px-6 py-6 space-y-5">

                {/* Crypto selector */}
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-[#0A1628]/40 mb-2">
                    Select Cryptocurrency
                  </label>
                  <select
                    value={tradeSymbol}
                    onChange={(e) => { setTradeSymbol(e.target.value); setTradeMsg(null); }}
                    className="w-full border-b border-[#E2E8F0] py-2 font-mono text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors"
                  >
                    {prices.filter((p) => p.price > 0).map((p) => (
                      <option key={p.symbol} value={p.symbol}>
                        {p.symbol.replace('/USD', '')} · {CRYPTO_NAMES[p.symbol]} ({fmtPrice(p.price)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase text-[#0A1628]/40 mb-2">
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    value={tradeAmount}
                    onChange={(e) => { setTradeAmount(e.target.value); setTradeMsg(null); }}
                    placeholder="100.00"
                    min="1"
                    step="1"
                    className="w-full border-b border-[#E2E8F0] py-2 font-mono text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent placeholder:text-[#0A1628]/25 transition-colors"
                  />
                  {estimatedUnits && (
                    <p className="mt-1 text-[10px] text-[#4A5568]">
                      ≈ {estimatedUnits} {tradeSymbol.replace('/USD', '')} at current price
                    </p>
                  )}
                </div>

                {/* Buy / Sell */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setTradeSide('buy')}
                    className={cn(
                      'flex-1 py-2.5 text-[11px] tracking-[0.18em] uppercase font-medium transition-colors border',
                      tradeSide === 'buy'
                        ? 'bg-[#166534] text-white border-[#166534]'
                        : 'border-[#E2E8F0] text-[#4A5568] hover:border-[#166534] hover:text-[#166534]',
                    )}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setTradeSide('sell')}
                    className={cn(
                      'flex-1 py-2.5 text-[11px] tracking-[0.18em] uppercase font-medium transition-colors border',
                      tradeSide === 'sell'
                        ? 'bg-[#991b1b] text-white border-[#991b1b]'
                        : 'border-[#E2E8F0] text-[#4A5568] hover:border-[#991b1b] hover:text-[#991b1b]',
                    )}
                  >
                    Sell
                  </button>
                </div>

                <button
                  onClick={handleTrade}
                  disabled={tradeLoading || !tradeAmount}
                  className="w-full py-3 bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tradeLoading ? 'Placing Order...' : `${tradeSide === 'buy' ? 'Buy' : 'Sell'} ${tradeSymbol.replace('/USD', '')}`}
                </button>

                {tradeMsg && (
                  <p className={cn(
                    'text-[12px] border-l-2 pl-3',
                    tradeMsg.ok
                      ? 'text-[#166534] border-[#166534]'
                      : 'text-[#991b1b] border-[#991b1b]',
                  )}>
                    {tradeMsg.text}
                  </p>
                )}
              </div>
            </div>

            {/* Crypto Holdings */}
            <div className="bg-white">
              <div className="px-4 sm:px-6 py-3 border-b border-[#E2E8F0]">
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Crypto Holdings</p>
              </div>

              {!positionsLoaded ? (
                <div className="px-6 py-8 space-y-3">
                  {[1,2].map((i) => <div key={i} className="h-10 animate-pulse bg-[#E2E8F0]" />)}
                </div>
              ) : positions.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-[#B8960C] mb-3">No Crypto Positions</p>
                  <p className="text-sm text-[#4A5568]">Your crypto holdings will appear here after your first purchase.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] sm:text-[13px]">
                    <thead>
                      <tr className="border-b border-[#E2E8F0]">
                        <th className="text-left px-4 sm:px-6 py-2.5 text-[9px] tracking-[0.15em] uppercase text-[#4A5568] font-normal">Asset</th>
                        <th className="text-right px-4 sm:px-6 py-2.5 text-[9px] tracking-[0.15em] uppercase text-[#4A5568] font-normal">Value</th>
                        <th className="text-right px-4 sm:px-6 py-2.5 text-[9px] tracking-[0.15em] uppercase text-[#4A5568] font-normal hidden sm:table-cell">P&amp;L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {positions.map((pos) => {
                        const pl  = parseFloat(pos.unrealized_pl);
                        const pct = parseFloat(pos.unrealized_plpc) * 100;
                        const mv  = parseFloat(pos.market_value);
                        return (
                          <tr key={pos.symbol} className="hover:bg-[#F8F9FA] transition-colors">
                            <td className="px-4 sm:px-6 py-3">
                              <p className="font-mono font-bold text-[#0A1628] text-xs">
                                {pos.symbol.replace('/USD', '')}
                              </p>
                              <p className="text-[10px] text-[#4A5568]">{pos.qty} units</p>
                            </td>
                            <td className="px-4 sm:px-6 py-3 text-right font-mono tabular-nums text-[#0A1628]">
                              ${mv.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                            </td>
                            <td className={cn(
                              'px-4 sm:px-6 py-3 text-right font-mono tabular-nums hidden sm:table-cell',
                              pl >= 0 ? 'text-[#166534]' : 'text-[#991b1b]',
                            )}>
                              {pl >= 0 ? '+' : ''}${Math.abs(pl).toFixed(2)}{' '}
                              <span className="text-[10px]">({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </section>
        </div>
      </main>
    </div>
  );
}
