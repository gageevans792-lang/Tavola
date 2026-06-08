'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);

  const isRejected = variant === 'rejected';
  const isExecuted = selfExecuted;
  const isPending  = !selfExecuted && variant === 'pending';

  // Check if extended fields are present
  const hasExtended = !!(rec.catalyst || rec.expected_timeframe || rec.exit_condition || rec.risk_factors?.length || rec.institutional_context);

  async function handleExecute() {
    if (!onExecute) return;
    try {
      await onExecute(rec as TradeRecommendation);
      setSelfExecuted(true);
      onExecuted?.(rec as TradeRecommendation);
      // Sync positions after trade so holdings table reflects new position
      setTimeout(() => {
        fetch('/api/alpaca/sync').catch(() => {});
      }, 2_000);
    } catch {
      // error is handled upstream (dashboard page sets error state)
    }
  }

  return (
    <div
      className={cn(
        'border bg-white transition-all',
        isRejected ? 'border-l-2 border-l-[#C41E3A] border-t-[#E2E8F0] border-r-[#E2E8F0] border-b-[#E2E8F0] opacity-70' : 'border-[#E2E8F0]',
        isExecuted && !isRejected ? 'opacity-60' : '',
        expanded && !isRejected ? 'border-l-2 border-l-[#B8960C] border-t-[#E2E8F0] border-r-[#E2E8F0] border-b-[#E2E8F0]' : '',
      )}
    >
      {/* Collapsed view — always visible */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={cn('text-[10px] tracking-[0.15em] uppercase px-2 py-0.5 font-medium shrink-0', ACTION_BADGE[rec.action])}>
              {rec.action}
            </span>
            <span className="font-mono text-sm font-bold text-[#0A1628] tracking-wide">{rec.symbol}</span>
            {rec.action !== 'hold' && (
              <span className="text-[11px] text-[#4A5568] tabular-nums">
                {rec.qty} sh
                {rec.estimated_value ? ` · $${rec.estimated_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isExecuted && (
              <span className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">Executed</span>
            )}
            {isRejected && (
              <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]/50">Blocked</span>
            )}
            {isPending && rec.action !== 'hold' && (
              <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]/50">Pending</span>
            )}
            {hasExtended && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-[#4A5568] hover:text-[#0A1628] transition-colors"
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
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

        {/* Reasoning (1-line collapsed) */}
        <p className={cn('mt-3 text-xs leading-relaxed text-[#4A5568]', !expanded && 'line-clamp-2')}>
          {rec.reasoning}
        </p>

        {/* Rejection reason */}
        {isRejected && 'rejection_reason' in rec && (
          <p className="mt-2 text-[11px] text-[#C41E3A]">Blocked: {rec.rejection_reason}</p>
        )}
      </div>

      {/* Expanded details */}
      {expanded && hasExtended && (
        <div className="border-t border-[#E2E8F0] px-4 pb-4 pt-4 space-y-4">
          {rec.catalyst && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[#B8960C] mb-1">Catalyst</p>
              <p className="text-[13px] text-[#0A1628] font-light leading-relaxed">{rec.catalyst}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {rec.expected_timeframe && (
              <div>
                <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568] mb-1">Timeframe</p>
                <p className="text-[13px] text-[#0A1628] font-medium">{rec.expected_timeframe}</p>
              </div>
            )}
          </div>

          {rec.exit_condition && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568] mb-1">Exit Condition</p>
              <p className="text-[13px] text-[#0A1628] font-light leading-relaxed">{rec.exit_condition}</p>
            </div>
          )}

          {rec.risk_factors && rec.risk_factors.length > 0 && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568] mb-2">Risk Factors</p>
              <ul className="space-y-1">
                {rec.risk_factors.map((rf, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-[#4A5568] leading-relaxed">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-[#991b1b] shrink-0" />
                    {rf}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rec.institutional_context && (
            <div className="border-t border-[#E2E8F0] pt-3">
              <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568] mb-1">Institutional Context</p>
              <p className="text-[12px] text-[#4A5568] italic leading-relaxed">{rec.institutional_context}</p>
            </div>
          )}
        </div>
      )}

      {/* Execute button — hidden once self-executed */}
      {isPending && rec.action !== 'hold' && onExecute && (
        <div className="px-4 pb-4 flex justify-end">
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
