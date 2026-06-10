'use client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegimeType = 'bull' | 'bear' | 'neutral';

interface MarketRegimeProps {
  regime: RegimeType;
  gainersCount: number;
  losersCount: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const REGIME_CONFIG: Record<
  RegimeType,
  { label: string; description: string; markerPct: number; textColor: string }
> = {
  bull: {
    label: 'Bull Market',
    description: 'Bull Market: risk appetite elevated',
    markerPct: 80,
    textColor: '#166534',
  },
  bear: {
    label: 'Bear Market',
    description: 'Bear Market: defensive positioning advised',
    markerPct: 20,
    textColor: '#991b1b',
  },
  neutral: {
    label: 'Neutral',
    description: 'Neutral: mixed signals, maintain current allocation',
    markerPct: 50,
    textColor: '#4A5568',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketRegime({ regime, gainersCount, losersCount }: MarketRegimeProps) {
  const config = REGIME_CONFIG[regime];

  return (
    <div className="border border-[#E2E8F0] bg-white">
      {/* Header */}
      <div className="border-b border-[#E2E8F0] px-6 py-4">
        <span className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C] font-medium">
          Market Regime
        </span>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Regime label */}
        <div className="flex items-center justify-between">
          <span
            className="font-serif text-xl font-light"
            style={{ color: config.textColor }}
          >
            {config.label}
          </span>
          <span
            className="text-[11px] tracking-[0.05em] font-medium uppercase"
            style={{ color: config.textColor }}
          >
            {regime === 'bull' ? 'Risk-On' : regime === 'bear' ? 'Risk-Off' : 'Balanced'}
          </span>
        </div>

        {/* Gradient bar with marker */}
        <div className="relative">
          <div
            className="h-2 w-full"
            style={{
              background: 'linear-gradient(to right, #991b1b, #4A5568, #166534)',
            }}
          />
          {/* Gold marker: vertical line positioned by regime */}
          <div
            className="absolute top-[-4px] h-[16px] w-[3px]"
            style={{
              left: `calc(${config.markerPct}% - 1.5px)`,
              backgroundColor: '#B8960C',
            }}
          />
          {/* Triangle pointer below bar */}
          <div
            className="absolute top-[8px]"
            style={{
              left: `calc(${config.markerPct}% - 5px)`,
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #B8960C',
            }}
          />
        </div>

        {/* Axis labels */}
        <div className="flex justify-between text-[10px] tracking-[0.08em] uppercase mt-3">
          <span className="text-[#991b1b] font-medium">Bear</span>
          <span className="text-[#4A5568]">Neutral</span>
          <span className="text-[#166534] font-medium">Bull</span>
        </div>

        {/* Description */}
        <p
          className="text-[13px] font-medium pt-1"
          style={{ color: config.textColor }}
        >
          {config.description}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-6 border-t border-[#E2E8F0] pt-4 font-mono tabular-nums">
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]">Advancing</span>
            <span className="text-sm font-medium text-[#166534]">{gainersCount}</span>
          </div>
          <div className="w-px h-4 bg-[#E2E8F0]" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]">Declining</span>
            <span className="text-sm font-medium text-[#991b1b]">{losersCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
