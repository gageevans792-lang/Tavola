import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { AIInsight, InsightType } from '@/types';
import { AlertTriangle, BarChart2, Lightbulb, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react';

interface AIFeedProps {
  insights: AIInsight[];
}

const TYPE_CONFIG: Record<InsightType, { icon: React.ElementType; color: string }> = {
  buy:       { icon: TrendingUp,  color: 'text-green-600 bg-green-50 dark:bg-green-900/30' },
  sell:      { icon: TrendingDown, color: 'text-red-600 bg-red-50 dark:bg-red-900/30' },
  hold:      { icon: BarChart2,   color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  rebalance: { icon: RefreshCw,   color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' },
  outlook:   { icon: Lightbulb,   color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
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
              className="flex gap-3 rounded-lg border border-gray-100 p-3 dark:border-gray-800"
            >
              <div className={cn('mt-0.5 shrink-0 rounded-lg p-1.5', color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                  {insight.message}
                </p>
                {insight.confidence_score !== null && (
                  <p className="mt-1 text-xs text-gray-400">
                    Confidence: {insight.confidence_score}%
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {insights.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No insights yet.</p>
        )}
      </div>
    </Card>
  );
}
