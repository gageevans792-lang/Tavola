'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { MoversResponse, Mover } from '@/app/api/market/movers/route';
import type { ClockResponse } from '@/app/api/market/clock/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function fmtTime(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour:   'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="h-3.5 w-12 animate-pulse bg-[#E2E8F0]" />
      <div className="ml-auto h-3.5 w-16 animate-pulse bg-[#E2E8F0]" />
      <div className="h-3.5 w-12 animate-pulse bg-[#E2E8F0]" />
    </div>
  );
}

// ── Mover row ─────────────────────────────────────────────────────────────────

function MoverRow({ mover }: { mover: Mover }) {
  const positive = mover.changePct >= 0;
  return (
    <div className="flex items-center gap-2 border-b border-[#E2E8F0] py-1.5 last:border-0">
      <span className="w-14 font-mono text-xs font-bold text-[#0A1628] tabular-nums">
        {mover.symbol}
      </span>
      <span className="ml-auto font-mono text-xs tabular-nums text-[#0A1628]">
        ${fmtPrice(mover.price)}
      </span>
      <span
        className={cn(
          'w-16 text-right font-mono text-xs font-medium tabular-nums',
          positive ? 'text-[#166534]' : 'text-[#991b1b]',
        )}
      >
        {fmtPct(mover.changePct)}
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketOverview() {
  const [movers, setMovers]       = useState<MoversResponse | null>(null);
  const [clock, setClock]         = useState<ClockResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [moversRes, clockRes] = await Promise.all([
        fetch('/api/market/movers'),
        fetch('/api/market/clock'),
      ]);

      if (!moversRes.ok || !clockRes.ok) throw new Error('fetch failed');

      const [moversData, clockData] = await Promise.all([
        moversRes.json() as Promise<MoversResponse>,
        clockRes.json()  as Promise<ClockResponse>,
      ]);

      setMovers(moversData);
      setClock(clockData);
      setLastUpdated(new Date());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="border border-[#E2E8F0] bg-white p-4">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568]">Market</span>

        {clock && (
          <>
            <div className="flex items-center gap-1.5 ml-auto">
              <span
                className={cn(
                  'h-2 w-2',
                  clock.is_open ? 'bg-[#166534]' : 'bg-[#991b1b]',
                )}
              />
              <span className={cn(
                'text-[11px] tracking-[0.12em] uppercase font-medium',
                clock.is_open ? 'text-[#166534]' : 'text-[#991b1b]',
              )}>
                {clock.is_open ? 'Open' : 'Closed'}
              </span>
            </div>
            {!clock.is_open && clock.next_open && (
              <span className="text-[10px] text-[#4A5568]">
                Opens {fmtTime(clock.next_open)}
              </span>
            )}
            {clock.is_open && clock.next_close && (
              <span className="text-[10px] text-[#4A5568]">
                Closes {fmtTime(clock.next_close)}
              </span>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-[#4A5568]">Market data unavailable.</p>
      )}

      {!error && (
        <div className="grid grid-cols-2 gap-4">

          {/* ── Gainers ─────────────────────────────────────────────────────── */}
          <div>
            <p className="mb-2 text-[10px] tracking-[0.15em] uppercase text-[#166534]">Gainers</p>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : movers?.gainers.length
                ? movers.gainers.map((m) => <MoverRow key={m.symbol} mover={m} />)
                : <p className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568] text-center py-4">No data available</p>
            }
          </div>

          {/* ── Losers ──────────────────────────────────────────────────────── */}
          <div>
            <p className="mb-2 text-[10px] tracking-[0.15em] uppercase text-[#991b1b]">Losers</p>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : movers?.losers.length
                ? movers.losers.map((m) => <MoverRow key={m.symbol} mover={m} />)
                : <p className="text-[11px] tracking-[0.1em] uppercase text-[#4A5568] text-center py-4">No data available</p>
            }
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {lastUpdated && (
        <p className="mt-3 text-[10px] text-[#4A5568]/60">
          Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}
