'use client';

import { useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveEquityTickerProps {
  equity: number;
  dayPl?: number;
  dayPlPct?: number;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtEquity(n: number): string {
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDayPl(n: number): string {
  const sign    = n >= 0 ? '+' : '-';
  const abs     = Math.abs(n);
  const dollars = '$' + abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return sign + dollars;
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

// ── Main component ────────────────────────────────────────────────────────────

export function LiveEquityTicker({
  equity,
  dayPl    = 0,
  dayPlPct = 0,
}: LiveEquityTickerProps) {
  // Track last update time: whenever equity prop changes to a real value
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const prevEquityRef = useRef(equity);
  useEffect(() => {
    if (equity > 0 && equity !== prevEquityRef.current) {
      prevEquityRef.current = equity;
      setLastUpdate(new Date());
    }
  }, [equity]);

  const plPositive = dayPl >= 0;

  return (
    <div
      style={{ background: '#0A1628' }}
      className="w-full px-6 py-6"
    >
      <div className="mx-auto max-w-7xl">
        {/* Label row */}
        <div className="flex items-center justify-between mb-2">
          <p
            className="text-[10px] tracking-[0.18em] uppercase"
            style={{ color: '#4A5568' }}
          >
            Total Portfolio Value
          </p>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 animate-pulse"
              style={{
                background:   '#22C55E',
                borderRadius: '50%',
              }}
            />
            <span
              className="text-[10px] tracking-[0.12em] uppercase"
              style={{ color: '#22C55E' }}
            >
              Live
            </span>
            <span
              className="text-[10px] ml-2"
              style={{ color: '#4A5568' }}
            >
              {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Equity value */}
        <p
          className="font-serif font-light tabular-nums leading-none"
          style={{
            fontSize: 52,
            color:    '#FFFFFF',
            transition: 'color 0.3s',
          }}
        >
          {equity > 0 ? fmtEquity(equity) : <span style={{ opacity: 0.3 }}>—</span>}
        </p>

        {/* Day P&L */}
        <p
          className="font-mono mt-2"
          style={{
            fontSize: 14,
            color:    plPositive ? '#22C55E' : '#EF4444',
          }}
        >
          {fmtDayPl(dayPl)} today{' '}
          <span style={{ color: plPositive ? '#16A34A' : '#DC2626', opacity: 0.8 }}>
            ({fmtPct(dayPlPct)})
          </span>
        </p>
      </div>
    </div>
  );
}
