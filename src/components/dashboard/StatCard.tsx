import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  icon?: LucideIcon;
}

export function StatCard({ title, value, change, changePositive, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {change && (
            <p className={cn('mt-1 text-sm font-medium', changePositive ? 'text-green-600' : 'text-red-500')}>
              {change}
            </p>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-indigo-50 p-2 dark:bg-indigo-900/30">
            <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
        )}
      </div>
    </Card>
  );
}
