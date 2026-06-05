'use client';

import { TradeRecommendation, RejectedRecommendation, ExecutedRecommendation } from '@/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type CardVariant = 'pending' | 'executed' | 'rejected';

interface RecommendationCardProps {
  rec: TradeRecommendation | RejectedRecommendation | ExecutedRecommendation;
  variant: CardVariant;
  onExecute?: (rec: TradeRecommendation) => void;
  executing?: boolean;
}

const ACTION_CONFIG = {
  buy: {
    label: 'BUY',
    icon: TrendingUp,
    color: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800',
    dot: 'bg-green-500',
  },
  sell: {
    label: 'SELL',
    icon: TrendingDown,
    color: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
    dot: 'bg-red-500',
  },
  hold: {
    label: 'HOLD',
    icon: Minus,
    color: 'text-gray-700 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700',
    dot: 'bg-gray-400',
  },
};

const RISK_BADGE = {
  low: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  medium: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  high: 'text-red-600 bg-red-50 dark:bg-red-900/20',
};

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 80 ? 'bg-green-500' : value >= 65 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-medium text-gray-600 dark:text-gray-400">
        {value}
      </span>
    </div>
  );
}

export function RecommendationCard({
  rec,
  variant,
  onExecute,
  executing,
}: RecommendationCardProps) {
  const cfg = ACTION_CONFIG[rec.action];
  const Icon = cfg.icon;

  const isRejected = variant === 'rejected';
  const isExecuted = variant === 'executed';
  const isPending = variant === 'pending';

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        isRejected
          ? 'border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900/40'
          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-bold',
              cfg.color,
            )}
          >
            <Icon className="h-3 w-3" />
            {cfg.label}
          </span>
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {rec.symbol}
          </span>
          {rec.action !== 'hold' && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {rec.qty} {rec.qty === 1 ? 'share' : 'shares'}
              {rec.estimated_value
                ? ` · $${rec.estimated_value.toFixed(0)}`
                : ''}
            </span>
          )}
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          {isExecuted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" /> Executed
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800">
              <XCircle className="h-3 w-3" /> Blocked
            </span>
          )}
          {isPending && rec.action !== 'hold' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              <Clock className="h-3 w-3" /> Pending
            </span>
          )}
        </div>
      </div>

      {/* Confidence */}
      {rec.action !== 'hold' && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Confidence</span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-xs font-medium',
                RISK_BADGE[rec.risk_level],
              )}
            >
              {rec.risk_level} risk
            </span>
          </div>
          <ConfidenceBar value={rec.confidence} />
        </div>
      )}

      {/* Reasoning */}
      <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {rec.reasoning}
      </p>

      {/* Rejection reason */}
      {isRejected && 'rejection_reason' in rec && (
        <p className="mt-2 text-xs text-red-500 dark:text-red-400">
          Blocked: {rec.rejection_reason}
        </p>
      )}

      {/* Execute button (review mode only) */}
      {isPending && rec.action !== 'hold' && onExecute && (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant={rec.action === 'sell' ? 'danger' : 'primary'}
            loading={executing}
            onClick={() => onExecute(rec as TradeRecommendation)}
          >
            Execute {cfg.label}
          </Button>
        </div>
      )}
    </div>
  );
}
