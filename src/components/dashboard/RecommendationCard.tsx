'use client';

import { useState } from 'react';
import { TradeRecommendation, RejectedRecommendation, ExecutedRecommendation } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

type CardVariant = 'pending' | 'executed' | 'rejected';

interface RecommendationCardProps {
  rec:          TradeRecommendation | RejectedRecommendation | ExecutedRecommendation;
  variant:      CardVariant;
  onExecute?:   (rec: TradeRecommendation) => Promise<void>;
  onExecuted?:  (rec: TradeRecommendation) => void;
  executing?:   boolean;
}

// Badge background per action
const ACTION_BADGE: Record<string, string> = {
  buy:  'bg-[#B8960C] text-[#0A1628]',
  sell: 'bg-[#C41E3A] text-white',
  hold: 'bg-[#E2E8F0] text-[#4A5568]',
};

const RISK_STYLE: Record<string, string> = {
  low:    'text-[#166534]',
  medium: 'text-amber-600',
  high:   'text-[#991b1b]',
};

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-[#E2E8F0]">
        <div className="h-px bg-[#B8960C] transition-all" style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-[11px] tabular-nums text-[#4A5568]">{value}%</span>
    </div>
  );
}

export function RecommendationCard({ rec, variant, onExecute, onExecuted, executing }: RecommendationCardProps) {
  // Local executed state — flips to true after a successful onExecute call
  const [selfExecuted, setSelfExecuted] = useState(variant === 'executed');

  const isRejected = variant === 'rejected';
  const isExecuted = selfExecuted;
  const isPending  = !selfExecuted && variant === 'pending';

  async function handleExecute() {
    if (!onExecute) return;
    try {
      await onExecute(rec as TradeRecommendation);
      setSelfExecuted(true);
      onExecuted?.(rec as TradeRecommendation);
    } catch {
      // error is handled upstream (dashboard page sets error state)
    }
  }

  return (
    <div
      className={cn(
        'border p-4 transition-opacity bg-white',
        isRejected ? 'border-l-2 border-l-[#C41E3A] border-t-[#E2E8F0] border-r-[#E2E8F0] border-b-[#E2E8F0] opacity-70' : 'border-[#E2E8F0]',
        isExecuted && !isRejected ? 'opacity-60' : '',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] tracking-[0.15em] uppercase px-2 py-0.5 font-medium', ACTION_BADGE[rec.action])}>
            {rec.action}
          </span>
          <span className="font-mono text-sm font-bold text-[#0A1628] tracking-wide">{rec.symbol}</span>
          {rec.action !== 'hold' && (
            <span className="text-[11px] text-[#4A5568] tabular-nums">
              {rec.qty} {rec.qty === 1 ? 'sh' : 'sh'}
              {rec.estimated_value ? ` · $${rec.estimated_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
            </span>
          )}
        </div>

        <div className="shrink-0">
          {isExecuted && (
            <span className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">Executed</span>
          )}
          {isRejected && (
            <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]/50">Blocked</span>
          )}
          {isPending && rec.action !== 'hold' && (
            <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]/50">Pending</span>
          )}
        </div>
      </div>

      {/* Confidence */}
      {rec.action !== 'hold' && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] tracking-[0.08em] uppercase text-[#4A5568]">Confidence</span>
            <span className={cn('text-[11px]', RISK_STYLE[rec.risk_level])}>
              {rec.risk_level} risk
            </span>
          </div>
          <ConfidenceBar value={rec.confidence} />
        </div>
      )}

      {/* Reasoning */}
      <p className="mt-3 text-xs leading-relaxed text-[#4A5568]">{rec.reasoning}</p>

      {/* Rejection reason */}
      {isRejected && 'rejection_reason' in rec && (
        <p className="mt-2 text-[11px] text-[#C41E3A]">Blocked: {rec.rejection_reason}</p>
      )}

      {/* Execute button — hidden once self-executed */}
      {isPending && rec.action !== 'hold' && onExecute && (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant={rec.action === 'sell' ? 'danger' : 'primary'}
            loading={executing}
            onClick={handleExecute}
          >
            Execute {rec.action.toUpperCase()}
          </Button>
        </div>
      )}
    </div>
  );
}
