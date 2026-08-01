'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TradeRecommendation, RejectedRecommendation, ExecutedRecommendation } from '@/types';
import { cn } from '@/lib/utils';

type CardVariant = 'pending' | 'accepted' | 'rejected' | 'watching';

interface RecommendationCardProps {
  rec:       TradeRecommendation | RejectedRecommendation | ExecutedRecommendation;
  variant:   CardVariant;
  onAccept?: (rec: TradeRecommendation) => void;
  onReject?: (rec: TradeRecommendation) => void;
  onWatch?:  (rec: TradeRecommendation) => void;
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

export function RecommendationCard({ rec, variant, onAccept, onReject, onWatch }: RecommendationCardProps) {
  const [localVariant, setLocalVariant] = useState<CardVariant>(variant);
  const [expanded, setExpanded]         = useState(false);

  const isRejected = localVariant === 'rejected';
  const isAccepted = localVariant === 'accepted';
  const isWatching = localVariant === 'watching';
  const isPending  = localVariant === 'pending';

  // Check if extended fields are present
  const hasExtended = !!(rec.catalyst || rec.expected_timeframe || rec.exit_condition || rec.risk_factors?.length || rec.institutional_context);

  function handleAccept() {
    setLocalVariant('accepted');
    onAccept?.(rec as TradeRecommendation);
  }

  function handleReject() {
    setLocalVariant('rejected');
    onReject?.(rec as TradeRecommendation);
  }

  function handleWatch() {
    setLocalVariant('watching');
    onWatch?.(rec as TradeRecommendation);
  }

  return (
    <div
      className={cn(
        'border bg-white transition-all',
        isRejected ? 'border-l-2 border-l-[#C41E3A] border-t-[#E2E8F0] border-r-[#E2E8F0] border-b-[#E2E8F0] opacity-70' : 'border-[#E2E8F0]',
        isAccepted ? 'border-l-2 border-l-[#166534] border-t-[#E2E8F0] border-r-[#E2E8F0] border-b-[#E2E8F0] opacity-70' : '',
        isWatching ? 'border-l-2 border-l-[#B8960C] border-t-[#E2E8F0] border-r-[#E2E8F0] border-b-[#E2E8F0] opacity-80' : '',
        expanded && isPending ? 'border-l-2 border-l-[#B8960C] border-t-[#E2E8F0] border-r-[#E2E8F0] border-b-[#E2E8F0]' : '',
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
            {isAccepted && (
              <span className="text-[10px] tracking-[0.15em] uppercase text-[#166534]">Accepted</span>
            )}
            {isWatching && (
              <span className="text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">Watching</span>
            )}
            {isRejected && (
              <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]/50">Dismissed</span>
            )}
            {isPending && rec.action !== 'hold' && (
              <span className="text-[10px] tracking-[0.1em] uppercase text-[#4A5568]/50">Pending Review</span>
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

        {/* 13F institutional badge */}
        {'institutional_signal' in rec && rec.institutional_signal && rec.institutional_signal.funds_buying >= 2 && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 bg-[#F8F9FA] border border-[#E2E8F0] px-2 py-0.5 text-[10px] font-medium text-[#0A1628] tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-[#B8960C] shrink-0" />
              {rec.institutional_signal.funds_buying} tracked fund{rec.institutional_signal.funds_buying !== 1 ? 's' : ''} increased position {rec.institutional_signal.quarter}
            </span>
          </div>
        )}

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

      {/* Action buttons — only for pending buy/sell when callbacks are provided */}
      {isPending && rec.action !== 'hold' && (onAccept || onReject || onWatch) && (
        <div className="border-t border-[#E2E8F0] px-4 py-3 flex items-center justify-end gap-2">
          {onWatch && (
            <button
              onClick={handleWatch}
              className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors px-3 py-1.5 border border-[#E2E8F0] hover:border-[#0A1628]"
            >
              Watch
            </button>
          )}
          {onReject && (
            <button
              onClick={handleReject}
              className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568] hover:text-[#C41E3A] transition-colors px-3 py-1.5 border border-[#E2E8F0] hover:border-[#C41E3A]"
            >
              Dismiss
            </button>
          )}
          {onAccept && (
            <button
              onClick={handleAccept}
              className="text-[10px] tracking-[0.12em] uppercase text-white bg-[#0A1628] hover:bg-[#162035] transition-colors px-3 py-1.5"
            >
              Accept
            </button>
          )}
        </div>
      )}
    </div>
  );
}
