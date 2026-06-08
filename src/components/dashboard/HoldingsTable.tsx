import { cn } from '@/lib/utils';
import type { SyncedHolding } from '@/lib/alpaca/sync';

const COLS = ['Ticker', 'Shares', 'Avg Price', 'Current Price', 'Market Value', 'P&L', 'P&L %', 'Weight'];

function fmt(n: number, decimals = 2): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPL(n: number): string {
  return (n >= 0 ? '+' : '-') + fmt(Math.abs(n));
}

function fmtPct(n: number): string {
  // unrealized_plpc from Alpaca is a decimal (e.g. 0.053 = 5.3%)
  const pct = n * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
}

interface HoldingsTableProps {
  holdings: SyncedHolding[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
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
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-[#E2E8F0]">
            {COLS.map((h) => (
              <th
                key={h}
                className="px-6 py-3 text-left text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const positive = h.unrealized_pl >= 0;
            return (
              <tr key={h.ticker} className="border-b border-[#E2E8F0] hover:bg-[#F8F9FA] transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium font-mono text-[#0A1628] text-xs tracking-wide">{h.ticker}</p>
                  {h.name && <p className="text-[11px] text-[#4A5568] mt-0.5">{h.name}</p>}
                </td>
                <td className="px-6 py-4 text-[#4A5568]">{h.qty}</td>
                <td className="px-6 py-4 text-[#4A5568]">{fmt(h.avg_entry_price)}</td>
                <td className="px-6 py-4 text-[#4A5568]">{fmt(h.current_price)}</td>
                <td className="px-6 py-4 text-[#0A1628] font-medium">{fmt(h.market_value, 0)}</td>
                <td className={cn('px-6 py-4 font-medium', positive ? 'text-[#166534]' : 'text-[#991b1b]')}>
                  {fmtPL(h.unrealized_pl)}
                </td>
                <td className={cn('px-6 py-4 font-medium', positive ? 'text-[#166534]' : 'text-[#991b1b]')}>
                  {fmtPct(h.unrealized_plpc)}
                </td>
                <td className="px-6 py-4 text-[#4A5568]">{h.weight_pct.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
        {/* Summary row */}
        <tfoot>
          <tr className="border-t-2 border-[#0A1628] bg-[#F8F9FA]">
            <td className="px-6 py-3 text-[11px] tracking-[0.12em] uppercase text-[#0A1628] font-medium" colSpan={4}>
              Total
            </td>
            <td className="px-6 py-3 font-medium text-[#0A1628]">{fmt(totalValue, 0)}</td>
            <td className={cn('px-6 py-3 font-medium', totalPositive ? 'text-[#166534]' : 'text-[#991b1b]')}>
              {fmtPL(totalPL)}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
