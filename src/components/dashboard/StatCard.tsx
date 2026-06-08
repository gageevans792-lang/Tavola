import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  loading?: boolean;
}

export function StatCard({ title, value, change, changePositive, loading }: StatCardProps) {
  return (
    <div className="flex flex-col justify-center px-5 py-3 min-w-0">
      <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568] whitespace-nowrap">{title}</p>
      {loading ? (
        <div className="mt-1 space-y-1">
          <div className="h-5 w-20 animate-pulse bg-[#E2E8F0]" />
          <div className="h-3 w-12 animate-pulse bg-[#E2E8F0]" />
        </div>
      ) : (
        <>
          <p className="mt-0.5 font-mono text-[17px] font-medium leading-tight text-[#0A1628] tabular-nums">{value}</p>
          {change && (
            <p className={cn('mt-0.5 text-[11px] tabular-nums', changePositive ? 'text-[#166534]' : 'text-[#991b1b]')}>
              {change}
            </p>
          )}
        </>
      )}
    </div>
  );
}
