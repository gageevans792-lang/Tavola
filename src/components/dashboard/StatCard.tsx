import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changePositive?: boolean;
}

export function StatCard({ title, value, change, changePositive }: StatCardProps) {
  return (
    <Card>
      <p className="text-[11px] tracking-[0.15em] uppercase text-[#4A5568]">{title}</p>
      <p className="mt-3 font-serif text-[28px] font-light leading-none text-[#0A1628]">{value}</p>
      {change && (
        <p className={cn('mt-2 text-xs font-medium', changePositive ? 'text-green-600' : 'text-red-500')}>
          {change}
        </p>
      )}
    </Card>
  );
}
