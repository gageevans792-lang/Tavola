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
          <p className="text-xs tracking-[0.1em] uppercase text-[#4A5568]">{title}</p>
          <p className="mt-2 font-serif text-2xl font-light text-[#0A1628]">{value}</p>
          {change && (
            <p className={cn('mt-1 text-sm font-medium', changePositive ? 'text-green-600' : 'text-red-500')}>
              {change}
            </p>
          )}
        </div>
        {Icon && (
          <div className="bg-[#F8F9FA] p-2">
            <Icon className="h-5 w-5 text-[#B8960C]" />
          </div>
        )}
      </div>
    </Card>
  );
}
