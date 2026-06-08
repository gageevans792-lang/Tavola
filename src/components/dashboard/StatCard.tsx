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
      {loading ? (
        <>
          <div className="h-2.5 w-16 animate-pulse bg-[#E2E8F0] mb-2" />
          <div className="mt-1 h-6 w-24 animate-pulse bg-[#E2E8F0]" />
          <div className="h-3 w-14 animate-pulse bg-[#E2E8F0] mt-1" />
        </>
      ) : (
        <>
          <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568] whitespace-nowrap truncate">{title}</p>
          <p className="mt-0.5 font-mono text-lg sm:text-2xl font-medium leading-tight text-[#0A1628] tabular-nums truncate">{value !== '' ? value : '—'}</p>
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
