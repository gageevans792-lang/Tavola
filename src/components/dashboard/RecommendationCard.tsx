'use client';

import { TradeRecommendation, RejectedRecommendation, ExecutedRecommendation } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

type CardVariant = 'pending' | 'executed' | 'rejected';

interface RecommendationCardProps {
  rec: TradeRecommendation | RejectedRecommendation | ExecutedRecommendation;
  variant: CardVariant;
  onExecute?: (rec: TradeRecommendation) => void;
  executing?: boolean;
}

const ACTION_STYLE: Record<string, string> = {
  buy:  'text-[#B8960C] border-[#B8960C]/30',
  sell: 'text-[#C41E3A] border-[#C41E3A]/30',
  hold: 'text-[#0A1628]/40 border-[#E2E8F0]',
};

const RISK_STYLE: Record<string, string> = {
  low:    'text-green-600',
  medium: 'text-amber-600',
  high:   'text-[#C41E3A]',
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 65 ? 'bg-amber-500' : 'bg-[#C41E3A]';
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-[#E2E8F0]">
        <div className={cn('h-px transition-all', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-xs text-[#4A5568]">{value}%</span>
    </div>
  );
}

export function RecommendationCard({ rec, variant, onExecute, executing }: RecommendationCardProps) {
  const isRejected = variant === 'rejected';
  const isExecuted = variant === 'executed';
  const isPending  = variant === 'pending';

  return (
    <div
      className={cn(
        'border p-4',
        isRejected ? 'border-[#E2E8F0] opacity-60' : 'border-[#E2E8F0] bg-white',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] tracking-[0.15em] uppercase border px-2 py-0.5', ACTION_STYLE[rec.action])}>
            {rec.action}
          </span>
          <span className="font-serif text-base font-light text-[#0A1628]">{rec.symbol}</span>
          {rec.action !== 'hold' && (
            <span className="text-xs text-[#4A5568]">
              {rec.qty} {rec.qty === 1 ? 'share' : 'shares'}
              {rec.estimated_value ? ` · $${rec.estimated_value.toFixed(0)}` : ''}
            </span>
          )}
        </div>

        <div className="shrink-0">
          {isExecuted && (
            <span className="text-[10px] tracking-[0.1em] uppercase text-green-600">Executed</span>
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
            <span className={cn('text-xs', RISK_STYLE[rec.risk_level])}>
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
        <p className="mt-2 text-xs text-[#C41E3A]">Blocked: {rec.rejection_reason}</p>
      )}

      {/* Execute button */}
      {isPending && rec.action !== 'hold' && onExecute && (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant={rec.action === 'sell' ? 'danger' : 'primary'}
            loading={executing}
            onClick={() => onExecute(rec as TradeRecommendation)}
          >
            Execute {rec.action.toUpperCase()}
          </Button>
        </div>
      )}
    </div>
  );
}
