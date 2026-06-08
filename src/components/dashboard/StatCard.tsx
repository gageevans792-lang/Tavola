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
    <div className="flex border-b border-[#E2E8F0] bg-white">
      {/* Gold left accent bar */}
      <div className="w-0.5 shrink-0 bg-[#B8960C]" />
      <div className="flex-1 p-6">
        <p className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568]">{title}</p>
        {loading ? (
          <div className="mt-3 space-y-2">
            <div className="h-8 w-3/4 animate-pulse bg-[#E2E8F0]" />
            <div className="h-3 w-1/2 animate-pulse bg-[#E2E8F0]" />
          </div>
        ) : (
          <>
            <p className="mt-3 font-serif text-[28px] font-light leading-none text-[#0A1628] tabular-nums">{value}</p>
            {change && (
              <p className={cn('mt-2 text-[11px] font-medium tabular-nums', changePositive ? 'text-[#166534]' : 'text-[#991b1b]')}>
                {change}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
