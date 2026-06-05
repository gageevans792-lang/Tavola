import { TopBar } from '@/components/layout/TopBar';
import { HoldingsTable } from '@/components/dashboard/HoldingsTable';
import { Holding } from '@/types';

const mockHoldings: Holding[] = [
  { id: '1', user_id: 'mock', ticker: 'AAPL', name: 'Apple Inc.',      qty: 50, avg_entry_price: 165,  current_price: 189.5, market_value: 9475,  unrealized_pl: 1225,  unrealized_plpc: 0.1485,  weight_pct: 21.7, updated_at: new Date().toISOString() },
  { id: '2', user_id: 'mock', ticker: 'NVDA', name: 'NVIDIA Corp.',    qty: 20, avg_entry_price: 420,  current_price: 875,   market_value: 17500, unrealized_pl: 9100,  unrealized_plpc: 1.0833,  weight_pct: 40.1, updated_at: new Date().toISOString() },
  { id: '3', user_id: 'mock', ticker: 'MSFT', name: 'Microsoft Corp.', qty: 30, avg_entry_price: 310,  current_price: 415,   market_value: 12450, unrealized_pl: 3150,  unrealized_plpc: 0.3387,  weight_pct: 28.5, updated_at: new Date().toISOString() },
  { id: '4', user_id: 'mock', ticker: 'TSLA', name: 'Tesla Inc.',      qty: 25, avg_entry_price: 240,  current_price: 185,   market_value: 4625,  unrealized_pl: -1375, unrealized_plpc: -0.2292, weight_pct: 9.7,  updated_at: new Date().toISOString() },
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
