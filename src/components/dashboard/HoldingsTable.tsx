import { cn } from '@/lib/utils';
import type { SyncedHolding } from '@/lib/alpaca/sync';

function fmt(n: number, decimals = 2): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPL(n: number): string {
  return (n >= 0 ? '+' : '-') + fmt(Math.abs(n));
}

function fmtPct(n: number): string {
  // unrealized_plpc is stored as a percentage (e.g. 5.3 = 5.3%)
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

interface HoldingsTableProps {
  holdings: SyncedHolding[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-8 text-center">
        <p className="font-serif text-lg font-light text-[#0A1628] mb-1">No positions yet.</p>
        <p className="text-sm text-[#4A5568]">Run an AI analysis to get started.</p>
      </div>
    );
  }

  const totalValue = holdings.reduce((sum, h) => sum + h.market_value, 0);
  const totalPL    = holdings.reduce((sum, h) => sum + h.unrealized_pl, 0);
  const totalPositive = totalPL >= 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm tabular-nums">
        <thead>
          <tr className="border-b border-[#E2E8F0]">
            {/* Ticker — always visible */}
            <th className="px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Ticker
            </th>
            {/* Shares — hidden on mobile */}
            <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Shares
            </th>
            {/* Avg Price — hidden on mobile */}
            <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Avg Price
            </th>
            {/* Current Price — hidden on mobile */}
            <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Current Price
            </th>
            {/* Market Value — always visible */}
            <th className="px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Market Value
            </th>
            {/* P&L — always visible */}
            <th className="px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              P&amp;L
            </th>
            {/* P&L % — hidden on mobile */}
            <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              P&amp;L %
            </th>
            {/* Weight — hidden on mobile */}
            <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Weight
            </th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const positive = h.unrealized_pl >= 0;
            return (
              <tr key={h.ticker} className="border-b border-[#E2E8F0] hover:bg-[#F8F9FA] transition-colors">
                <td className="px-3 sm:px-6 py-2.5">
                  <span className="font-medium font-mono text-[11px] sm:text-[12px] text-[#0A1628] tracking-wide">{h.ticker}</span>
                </td>
                <td className="hidden sm:table-cell px-3 sm:px-6 py-2.5 text-[#4A5568]">{h.qty}</td>
                <td className="hidden sm:table-cell px-3 sm:px-6 py-2.5 text-[#4A5568]">{fmt(h.avg_entry_price)}</td>
                <td className="hidden sm:table-cell px-3 sm:px-6 py-2.5 text-[#4A5568]">{fmt(h.current_price)}</td>
                <td className="px-3 sm:px-6 py-2.5 text-[#0A1628] font-medium">{fmt(h.market_value, 0)}</td>
                <td className={cn('px-3 sm:px-6 py-2.5 font-medium', positive ? 'text-[#166534]' : 'text-[#991b1b]')}>
                  {fmtPL(h.unrealized_pl)}
                </td>
                <td className={cn('hidden sm:table-cell px-3 sm:px-6 py-2.5 font-medium', positive ? 'text-[#166534]' : 'text-[#991b1b]')}>
                  <div className="flex items-center gap-2">
                    <span>{fmtPct(h.unrealized_plpc)}</span>
                    <div className="w-12 h-1 bg-[#E2E8F0] hidden sm:block">
                      <div
                        className={cn('h-full', positive ? 'bg-[#166534]' : 'bg-[#991b1b]')}
                        style={{ width: `${Math.min(Math.abs(h.unrealized_plpc * 100) * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="hidden sm:table-cell px-3 sm:px-6 py-2.5 text-[#4A5568]">{h.weight_pct.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
        {/* Summary row */}
        <tfoot>
          <tr className="border-t-2 border-[#0A1628] bg-[#F8F9FA]">
            <td className="px-3 sm:px-6 py-2 text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#0A1628] font-medium" colSpan={1}>
              Total
            </td>
            {/* Hidden cols on mobile (Shares, Avg Price, Current Price) */}
            <td className="hidden sm:table-cell" colSpan={3} />
            <td className="px-3 sm:px-6 py-2 font-medium text-[#0A1628]">{fmt(totalValue, 0)}</td>
            <td className={cn('px-3 sm:px-6 py-2 font-medium', totalPositive ? 'text-[#166534]' : 'text-[#991b1b]')}>
              {fmtPL(totalPL)}
            </td>
            {/* Hidden cols on mobile (P&L %, Weight) */}
            <td className="hidden sm:table-cell" colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
