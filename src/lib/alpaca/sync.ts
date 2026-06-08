import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getAccount, getPositions } from './client';
import type { AlpacaPosition } from '@/types';

// Service role bypasses RLS — required for server-side upserts to holdings
function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export interface SyncedHolding {
  id: string;
  user_id: string;
  ticker: string;
  name: string | null;
  qty: number;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  weight_pct: number;
  updated_at: string;
}

// positions + portfolioValue are optional: when omitted the function fetches them itself
// (used by fire-and-forget callers like auto-invest; portfolio route passes them to avoid
// a redundant round-trip to Alpaca)
export async function syncHoldingsToSupabase(
  userId: string,
  positions?: AlpacaPosition[],
  portfolioValue?: number,
): Promise<SyncedHolding[]> {
  const supabase = adminClient();

  // Fetch from Alpaca only when the caller didn't supply the data
  if (positions === undefined || portfolioValue === undefined) {
    const [acct, pos] = await Promise.all([getAccount(), getPositions()]);
    positions     = pos;
    portfolioValue = parseFloat(acct.portfolio_value) || parseFloat(acct.equity);
  }

  console.log('[sync] Upserting to Supabase:', positions.length, 'positions');

  if (positions.length > 0) {
    const rows = positions.map((p: AlpacaPosition) => {
      const marketValue = parseFloat(p.market_value);
      return {
        user_id:         userId,
        ticker:          p.symbol,
        name:            null,
        qty:             parseFloat(p.qty),
        avg_entry_price: parseFloat(p.avg_entry_price),
        current_price:   parseFloat(p.current_price),
        market_value:    marketValue,
        unrealized_pl:   parseFloat(p.unrealized_pl),
        unrealized_plpc: parseFloat(p.unrealized_plpc) * 100,
        weight_pct:      portfolioValue > 0 ? (marketValue / portfolioValue) * 100 : 0,
        updated_at:      new Date().toISOString(),
      };
    });

    const { error: upsertErr } = await supabase
      .from('holdings')
      .upsert(rows, { onConflict: 'user_id,ticker' });

    if (upsertErr) throw new Error(`upsert: ${upsertErr.message}`);

    // Delete stale tickers no longer in Alpaca positions
    const currentTickers = positions.map((p) => p.symbol);
    const { error: deleteErr } = await supabase
      .from('holdings')
      .delete()
      .eq('user_id', userId)
      .not('ticker', 'in', `(${currentTickers.map((t) => `"${t}"`).join(',')})`);

    if (deleteErr) {
      console.warn('[sync] stale delete failed (non-fatal):', deleteErr.message);
    }
  } else {
    await supabase.from('holdings').delete().eq('user_id', userId);
  }

  console.log('[sync] Upsert complete');

  const { data, error: fetchErr } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', userId)
    .order('market_value', { ascending: false });

  if (fetchErr) throw new Error(`fetch: ${fetchErr.message}`);
  return (data ?? []) as SyncedHolding[];
}
