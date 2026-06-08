import { cn } from '@/lib/utils';
import type { AIInsight, InsightType } from '@/types';

interface AIFeedProps {
  insights: AIInsight[];
}

// Left border color per type
const LEFT_BORDER: Record<InsightType, string> = {
  buy:       'border-l-[#B8960C]',
  sell:      'border-l-[#991b1b]',
  hold:      'border-l-[#6b7280]',
  rebalance: 'border-l-[#0A1628]',
  outlook:   'border-l-[#6b7280]',
};

// Badge style per type
const BADGE_STYLE: Record<InsightType, string> = {
  buy:       'text-[#B8960C]',
  sell:      'text-[#991b1b]',
  hold:      'text-[#4A5568]',
  rebalance: 'text-[#0A1628]',
  outlook:   'text-[#4A5568]',
};

export function AIFeed({ insights }: AIFeedProps) {
  return (
    <div>
      <p className="mb-3 text-[10px] tracking-[0.15em] uppercase text-[#B8960C]">AI Signals</p>
      <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] bg-white">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={cn('border-l-2 px-5 py-4', LEFT_BORDER[insight.type])}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-[10px] tracking-[0.15em] uppercase font-medium', BADGE_STYLE[insight.type])}>
                    {insight.type}
                  </span>
                  {insight.ticker && (
                    <span className="font-mono text-xs font-bold text-[#0A1628] tracking-wide">{insight.ticker}</span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-[#4A5568]">{insight.message}</p>
                {insight.confidence_score !== null && (
                  <div className="mt-2">
                    <div className="h-px bg-[#E2E8F0]">
                      <div
                        className="h-px bg-[#B8960C] transition-all"
                        style={{ width: `${insight.confidence_score}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-[#4A5568]/60 tabular-nums">{insight.confidence_score}% confidence</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {insights.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-[#4A5568]">No insights yet. Run an analysis to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
