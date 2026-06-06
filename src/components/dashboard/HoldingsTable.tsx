import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { Holding } from '@/types';

interface HoldingsTableProps {
  holdings: Holding[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  return (
    <Card padding="sm">
      <CardHeader className="px-2 pt-2">
        <CardTitle>Holdings</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              {['Ticker', 'Qty', 'Avg Cost', 'Price', 'Mkt Value', 'P&L'].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-[11px] tracking-[0.1em] uppercase text-[#4A5568]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F8F9FA]">
            {holdings.map((h) => (
              <tr key={h.ticker} className="hover:bg-[#F8F9FA]">
                <td className="px-3 py-3">
                  <div>
                    <p className="font-medium text-[#0A1628]">{h.ticker}</p>
                    {h.name && <p className="text-xs text-[#4A5568]">{h.name}</p>}
                  </div>
                </td>
                <td className="px-3 py-3 text-[#4A5568]">{h.qty}</td>
                <td className="px-3 py-3 text-[#4A5568]">
                  ${h.avg_entry_price.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-[#4A5568]">
                  ${h.current_price.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-[#4A5568]">
                  ${h.market_value.toLocaleString()}
                </td>
                <td
                  className={cn(
                    'px-3 py-3 font-medium',
                    h.unrealized_pl >= 0 ? 'text-green-600' : 'text-red-500',
                  )}
                >
                  {h.unrealized_pl >= 0 ? '+' : ''}${h.unrealized_pl.toFixed(2)}
                  <span className="ml-1 text-xs">
                    ({(h.unrealized_plpc * 100).toFixed(2)}%)
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
