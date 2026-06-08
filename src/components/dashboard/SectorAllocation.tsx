'use client';

import type { SyncedHolding } from '@/lib/alpaca/sync';

// ── Sector mapping ────────────────────────────────────────────────────────────

const SECTORS: Record<string, string> = {
  NVDA: 'Technology',  AAPL: 'Technology',   MSFT: 'Technology',
  AMD:  'Technology',  GOOGL: 'Technology',  META: 'Technology',
  AMZN: 'Consumer Disc.', TSLA: 'Consumer Disc.', HD: 'Consumer Disc.',
  WMT:  'Consumer Disc.',
  JPM:  'Financials',  GS: 'Financials',     BAC: 'Financials',
  V:    'Financials',  MA: 'Financials',      MS: 'Financials',
  JNJ:  'Healthcare',  UNH: 'Healthcare',
  XOM:  'Energy',      CVX: 'Energy',
};

// ── Color palette ─────────────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  'Technology':     '#3B82F6',
  'Financials':     '#B8960C',
  'Healthcare':     '#22C55E',
  'Energy':         '#EF4444',
  'Consumer Disc.': '#A855F7',
  'Other':          '#6B7280',
};

function getSector(ticker: string): string {
  return SECTORS[ticker.toUpperCase()] ?? 'Other';
}

function getColor(sector: string): string {
  return SECTOR_COLORS[sector] ?? SECTOR_COLORS['Other'];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectorRow {
  sector: string;
  value:  number;
  pct:    number;
  color:  string;
}

// ── Main component ────────────────────────────────────────────────────────────

interface SectorAllocationProps {
  holdings: SyncedHolding[];
}

export function SectorAllocation({ holdings }: SectorAllocationProps) {
  if (holdings.length === 0) {
    return (
      <div className="bg-white border border-[#E2E8F0] px-6 py-8">
        <p
          className="text-[10px] tracking-[0.15em] uppercase mb-4"
          style={{ color: '#4A5568' }}
        >
          Sector Allocation
        </p>
        <p className="text-sm" style={{ color: '#4A5568' }}>No positions</p>
      </div>
    );
  }

  // Aggregate by sector
  const sectorValues: Record<string, number> = {};
  let totalValue = 0;

  for (const h of holdings) {
    const sector = getSector(h.ticker);
    sectorValues[sector] = (sectorValues[sector] ?? 0) + h.market_value;
    totalValue += h.market_value;
  }

  const rows: SectorRow[] = Object.entries(sectorValues)
    .map(([sector, value]) => ({
      sector,
      value,
      pct:   totalValue > 0 ? (value / totalValue) * 100 : 0,
      color: getColor(sector),
    }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="bg-white border border-[#E2E8F0] px-6 py-5">
      <p
        className="text-[10px] tracking-[0.15em] uppercase mb-5"
        style={{ color: '#4A5568' }}
      >
        Sector Allocation
      </p>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.sector}>
            {/* Label row */}
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-[11px] tracking-[0.05em]"
                style={{ color: '#0A1628' }}
              >
                {row.sector}
              </span>
              <span
                className="font-mono text-[11px]"
                style={{ color: '#4A5568' }}
              >
                {row.pct.toFixed(1)}%
              </span>
            </div>
            {/* Bar */}
            <div
              className="w-full"
              style={{ height: 4, background: '#E2E8F0' }}
            >
              <div
                style={{
                  height:     '100%',
                  width:      `${Math.min(row.pct, 100)}%`,
                  background: row.color,
                  transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Color key */}
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
        {rows.map((row) => (
          <div key={row.sector} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 shrink-0"
              style={{ background: row.color }}
            />
            <span className="text-[10px]" style={{ color: '#4A5568' }}>{row.sector}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
