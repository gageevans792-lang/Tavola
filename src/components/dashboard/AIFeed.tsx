import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { AIInsight, InsightType } from '@/types';

interface AIFeedProps {
  insights: AIInsight[];
}

const TYPE_STYLE: Record<InsightType, string> = {
  buy:       'text-[#B8960C] border-[#B8960C]/30',
  sell:      'text-[#C41E3A] border-[#C41E3A]/30',
  hold:      'text-[#0A1628]/40 border-[#E2E8F0]',
  rebalance: 'text-[#0A1628] border-[#0A1628]/20',
  outlook:   'text-[#4A5568] border-[#E2E8F0]',
};

export function AIFeed({ insights }: AIFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Insights</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        {insights.map((insight) => {
          const title = insight.ticker
            ? `${insight.ticker} — ${insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}`
            : insight.type.charAt(0).toUpperCase() + insight.type.slice(1);
          return (
            <div key={insight.id} className="border border-[#E2E8F0] p-4">
              <div className="flex items-start gap-3">
                <span className={cn('text-[10px] tracking-[0.15em] uppercase border px-2 py-0.5 mt-0.5 shrink-0', TYPE_STYLE[insight.type])}>
                  {insight.type}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0A1628]">{title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[#4A5568]">{insight.message}</p>
                  {insight.confidence_score !== null && (
                    <p className="mt-1 text-xs text-[#4A5568]/60">Confidence: {insight.confidence_score}%</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {insights.length === 0 && (
          <p className="text-sm text-[#4A5568]">No insights yet.</p>
        )}
      </div>
    </Card>
  );
}
