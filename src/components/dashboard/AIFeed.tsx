import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { AIInsight } from '@/types';
import { AlertTriangle, BarChart2, Lightbulb } from 'lucide-react';

interface AIFeedProps {
  insights: AIInsight[];
}

const typeConfig = {
  analysis: { icon: BarChart2, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  recommendation: { icon: Lightbulb, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' },
  alert: { icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
};

export function AIFeed({ insights }: AIFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Insights</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        {insights.map((insight) => {
          const { icon: Icon, color } = typeConfig[insight.type];
          return (
            <div key={insight.id} className="flex gap-3 rounded-lg border border-gray-100 p-3 dark:border-gray-800">
              <div className={cn('mt-0.5 shrink-0 rounded-lg p-1.5', color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{insight.title}</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{insight.content}</p>
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
