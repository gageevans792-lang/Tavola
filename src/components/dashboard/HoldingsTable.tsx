import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { Holding } from '@/types';

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
            <tr className="border-b border-gray-100 dark:border-gray-800">
              {['Symbol', 'Qty', 'Avg Cost', 'Price', 'Mkt Value', 'P&L'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {holdings.map((h) => (
              <tr key={h.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{h.symbol}</p>
                    <p className="text-xs text-gray-500">{h.name}</p>
                  </div>
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{h.qty}</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                  ${h.avg_entry_price.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                  ${h.current_price.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                  ${h.market_value.toLocaleString()}
                </td>
                <td className={cn('px-3 py-3 font-medium', h.unrealized_pl >= 0 ? 'text-green-600' : 'text-red-500')}>
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
