'use client';

import { cn } from '@/lib/utils';

export interface InvestmentStrategy {
  id: string;
  name: string;
  tagline: string;
  description: string;
  risk_level: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  target_return_pct: number;
  max_drawdown_pct: number;
  confidence_threshold: number;
  max_position_pct: number;
  max_trade_value: number;
  accent_color: string;
  characteristics: string[];
  system_prompt: string;
}

interface RiskDisplay {
  label: string;
  dotColor: string;
}

function getRiskDisplay(risk_level: InvestmentStrategy['risk_level']): RiskDisplay {
  switch (risk_level) {
    case 'conservative':
      return { label: 'Low Risk', dotColor: '#166534' };
    case 'moderate':
      return { label: 'Moderate Risk', dotColor: '#1D4ED8' };
    case 'aggressive':
      return { label: 'High Risk', dotColor: '#D97706' };
    case 'very_aggressive':
      return { label: 'Maximum Risk', dotColor: '#C41E3A' };
  }
}

export interface StrategyCardProps {
  strategy: InvestmentStrategy;
  isActive: boolean;
  onActivate: () => void;
  activating: boolean;
}

export function StrategyCard({ strategy, isActive, onActivate, activating }: StrategyCardProps) {
  const risk = getRiskDisplay(strategy.risk_level);

  return (
    <div
      className={cn(
        'relative flex flex-col bg-white border border-[#E2E8F0] p-6',
        isActive && 'border-l-2',
      )}
      style={isActive ? { borderLeftColor: strategy.accent_color } : undefined}
    >
      {/* Risk level */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: risk.dotColor }}
        />
        <span className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568]">
          {risk.label}
        </span>
      </div>

      {/* Name */}
      <h3 className="font-serif text-xl font-light text-[#0A1628] mb-1">{strategy.name}</h3>

      {/* Tagline */}
      <p className="text-sm text-[#4A5568] mb-4">{strategy.tagline}</p>

      {/* Key metrics */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
        <div>
          <span className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">
            TARGET:&nbsp;
          </span>
          <span className="text-[10px] tracking-[0.12em] uppercase font-mono tabular-nums text-[#166534]">
            +{strategy.target_return_pct}% / yr
          </span>
        </div>
        <div>
          <span className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">
            MAX DD:&nbsp;
          </span>
          <span className="text-[10px] tracking-[0.12em] uppercase font-mono tabular-nums text-[#991b1b]">
            -{strategy.max_drawdown_pct}%
          </span>
        </div>
        <div>
          <span className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">
            CONF:&nbsp;
          </span>
          <span className="text-[10px] tracking-[0.12em] uppercase font-mono tabular-nums text-[#0A1628]">
            {strategy.confidence_threshold}%
          </span>
        </div>
      </div>

      {/* Characteristics */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {strategy.characteristics.map((char) => (
          <span
            key={char}
            className="bg-[#F8F9FA] border border-[#E2E8F0] text-[11px] px-2 py-0.5 text-[#4A5568]"
          >
            {char}
          </span>
        ))}
      </div>

      {/* Spacer to push button to bottom */}
      <div className="flex-1" />

      {/* Activate button */}
      {isActive ? (
        <button
          disabled
          className="w-full border border-[#B8960C] text-[#B8960C] text-[11px] tracking-[0.15em] uppercase h-10 disabled:cursor-not-allowed"
        >
          Active Strategy
        </button>
      ) : (
        <button
          onClick={onActivate}
          disabled={activating}
          className="w-full bg-[#0A1628] text-white text-[11px] tracking-[0.15em] uppercase h-10 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {activating ? 'Activating…' : 'Activate Strategy'}
        </button>
      )}
    </div>
  );
}
