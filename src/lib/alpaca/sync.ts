import { getAccount, getPositions } from './client';
import { createClient } from '@/lib/supabase/server';
import type { AlpacaPosition } from '@/types';

export async function syncHoldingsToSupabase(userId: string): Promise<void> {
  const supabase = await createClient();

  const [account, positions] = await Promise.all([getAccount(), getPositions()]);

  const portfolioValue = parseFloat(account.portfolio_value);
  if (portfolioValue <= 0) return;

  const rows = positions.map((p: AlpacaPosition) => {
    const marketValue = parseFloat(p.market_value);
    return {
      user_id: userId,
      ticker: p.symbol,
      qty: parseFloat(p.qty),
      avg_entry_price: parseFloat(p.avg_entry_price),
      current_price: parseFloat(p.current_price),
      market_value: marketValue,
      unrealized_pl: parseFloat(p.unrealized_pl),
      unrealized_plpc: parseFloat(p.unrealized_plpc),
      weight_pct: (marketValue / portfolioValue) * 100,
      updated_at: new Date().toISOString(),
    };
  });

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('holdings')
    .upsert(rows, { onConflict: 'user_id,ticker' });

  if (error) throw new Error(`syncHoldingsToSupabase: ${error.message}`);
}
