import { getAccount, getPositions } from '@/lib/alpaca/client';
import type { SyncedHolding } from '@/lib/alpaca/sync';

export interface FounderPortfolioState {
  holdings:  SyncedHolding[];
  portValue: number;
  equity:    number;
  cash:      number;
}

// Single source of truth for the founder's live portfolio.
// Returns live Alpaca data — never reads from the holdings table.
export async function getFounderPositions(userId: string): Promise<FounderPortfolioState> {
  const [account, rawPositions] = await Promise.all([getAccount(), getPositions()]);

  const portValue = parseFloat(account.portfolio_value) || parseFloat(account.equity);
  const equity    = parseFloat(account.equity);
  const cash      = parseFloat(account.cash);

  const holdings: SyncedHolding[] = rawPositions.map((p) => {
    const mv = parseFloat(p.market_value);
    return {
      id:              p.asset_id,
      user_id:         userId,
      ticker:          p.symbol,
      name:            p.symbol,
      qty:             parseFloat(p.qty),
      avg_entry_price: parseFloat(p.avg_entry_price),
      current_price:   parseFloat(p.current_price || p.avg_entry_price),
      market_value:    mv,
      unrealized_pl:   parseFloat(p.unrealized_pl || '0'),
      unrealized_plpc: parseFloat(p.unrealized_plpc || '0') * 100,
      weight_pct:      portValue > 0 ? (mv / portValue) * 100 : 0,
      updated_at:      new Date().toISOString(),
    };
  });

  holdings.sort((a, b) => b.market_value - a.market_value);
  return { holdings, portValue, equity, cash };
}
