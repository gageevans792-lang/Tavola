import { TopBar } from '@/components/layout/TopBar';
import { HoldingsTable } from '@/components/dashboard/HoldingsTable';
import { Holding } from '@/types';

const mockHoldings: Holding[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', qty: 50, avg_entry_price: 165, current_price: 189.5, market_value: 9475, unrealized_pl: 1225, unrealized_plpc: 0.1485, change_today: 1.2 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', qty: 20, avg_entry_price: 420, current_price: 875, market_value: 17500, unrealized_pl: 9100, unrealized_plpc: 1.0833, change_today: 3.4 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', qty: 30, avg_entry_price: 310, current_price: 415, market_value: 12450, unrealized_pl: 3150, unrealized_plpc: 0.3387, change_today: 0.8 },
  { symbol: 'TSLA', name: 'Tesla Inc.', qty: 25, avg_entry_price: 240, current_price: 185, market_value: 4625, unrealized_pl: -1375, unrealized_plpc: -0.2292, change_today: -2.1 },
];

export default function HoldingsPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Holdings" />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl">
          <HoldingsTable holdings={mockHoldings} />
        </div>
      </main>
    </div>
  );
}
