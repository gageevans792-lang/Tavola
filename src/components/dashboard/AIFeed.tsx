import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { AIInsight, InsightType } from '@/types';
import { AlertTriangle, BarChart2, Lightbulb, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';

interface AIFeedProps {
  insights: AIInsight[];
}

const TYPE_CONFIG: Record<InsightType, { icon: React.ElementType; color: string }> = {
  buy:       { icon: TrendingUp,   color: 'text-green-600 bg-green-50' },
  sell:      { icon: TrendingDown, color: 'text-red-600 bg-red-50' },
  hold:      { icon: BarChart2,    color: 'text-[#4A5568] bg-[#F8F9FA]' },
  rebalance: { icon: RefreshCw,    color: 'text-[#B8960C] bg-amber-50' },
  outlook:   { icon: Lightbulb,    color: 'text-[#B8960C] bg-amber-50' },
};

export function AIFeed({ insights }: AIFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Insights</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        {insights.map((insight) => {
          const { icon: Icon, color } = TYPE_CONFIG[insight.type];
          const title = insight.ticker
            ? `${insight.ticker} — ${insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}`
            : insight.type.charAt(0).toUpperCase() + insight.type.slice(1);
          return (
            <div
              key={insight.id}
              className="flex gap-3 border border-[#E2E8F0] p-4"
            >
              <div className={cn('mt-0.5 shrink-0 p-1.5', color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#0A1628]">{title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-[#4A5568]">
                  {insight.message}
                </p>
                {insight.confidence_score !== null && (
                  <p className="mt-1 text-xs text-[#4A5568]/60">
                    Confidence: {insight.confidence_score}%
                  </p>
                )}
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
