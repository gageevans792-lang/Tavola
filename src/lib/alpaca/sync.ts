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

export async function syncHoldingsToSupabase(userId: string): Promise<SyncedHolding[]> {
  const supabase = adminClient();

  const [account, positions] = await Promise.all([getAccount(), getPositions()]);

  const portfolioValue = parseFloat(account.portfolio_value) || parseFloat(account.equity);

  // ── Upsert current positions ────────────────────────────────────────────────
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
        unrealized_plpc: parseFloat(p.unrealized_plpc),
        weight_pct:      portfolioValue > 0 ? (marketValue / portfolioValue) * 100 : 0,
        updated_at:      new Date().toISOString(),
      };
    });

    const { error: upsertErr } = await supabase
      .from('holdings')
      .upsert(rows, { onConflict: 'user_id,ticker' });

    if (upsertErr) {
      throw new Error(`syncHoldingsToSupabase upsert: ${upsertErr.message}`);
    }

    // ── Delete holdings that are no longer in Alpaca positions ────────────────
    const currentTickers = positions.map((p: AlpacaPosition) => p.symbol);
    // PostgREST 'in' filter expects unquoted symbols: (AAPL,TSLA)
    await supabase
      .from('holdings')
      .delete()
      .eq('user_id', userId)
      .not('ticker', 'in', `(${currentTickers.join(',')})`);
  } else {
    // No open positions — clear all holdings for this user
    await supabase.from('holdings').delete().eq('user_id', userId);
  }

  // ── Return fresh rows ───────────────────────────────────────────────────────
  const { data, error: fetchErr } = await supabase
    .from('holdings')
    .select('*')
    .eq('user_id', userId)
    .order('market_value', { ascending: false });

  if (fetchErr) throw new Error(`syncHoldingsToSupabase fetch: ${fetchErr.message}`);
  return (data ?? []) as SyncedHolding[];
}
