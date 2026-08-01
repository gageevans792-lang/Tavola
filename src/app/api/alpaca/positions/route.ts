import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getAccount, getPositions, getTickerPrices } from '@/lib/alpaca/client';
import { isFounder } from '@/lib/founder';
import type { SyncedHolding } from '@/lib/alpaca/sync';

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── GET /api/alpaca/positions ─────────────────────────────────────────────────
// Returns live positions as SyncedHolding[].
//   Founder:     live Alpaca API — bypasses the holdings table entirely.
//   Non-founder: refreshes prices then reads from simulated holdings table.

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Founder: live Alpaca data ─────────────────────────────────────────────
  if (isFounder(user.id, user.email)) {
    try {
      const [account, rawPositions] = await Promise.all([getAccount(), getPositions()]);
      const portValue = parseFloat(account.portfolio_value) || parseFloat(account.equity);

      const holdings: SyncedHolding[] = rawPositions.map((p) => {
        const mv = parseFloat(p.market_value);
        return {
          id:              p.asset_id ?? p.symbol,
          user_id:         user.id,
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
      return NextResponse.json({ holdings, source: 'live' });
    } catch (err) {
      console.error('[positions] Alpaca fetch failed:', err instanceof Error ? err.message : err);
      return NextResponse.json({ error: 'Alpaca unavailable' }, { status: 503 });
    }
  }

  // ── Non-founder: refresh prices then return simulated holdings ────────────
  const supabaseAdmin = adminClient();

  const { data: rawHoldings } = await supabaseAdmin
    .from('holdings')
    .select('ticker, qty, avg_entry_price')
    .eq('user_id', user.id);

  if (rawHoldings && rawHoldings.length > 0) {
    try {
      const tickers = rawHoldings.map((h: { ticker: string }) => h.ticker);
      const prices  = await getTickerPrices(tickers);

      for (const h of rawHoldings as { ticker: string; qty: number; avg_entry_price: number }[]) {
        const info = prices[h.ticker];
        if (!info || info.price_unavailable || info.price <= 0) continue;
        const price = info.price;
        const qty   = Number(h.qty);
        const avg   = Number(h.avg_entry_price);
        await supabaseAdmin.from('holdings').update({
          current_price:   price,
          market_value:    qty * price,
          unrealized_pl:   (price - avg) * qty,
          unrealized_plpc: avg > 0 ? ((price - avg) / avg) * 100 : 0,
          updated_at:      new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('ticker', h.ticker);
      }
    } catch (err) {
      console.warn('[positions] price refresh failed (non-fatal):', err instanceof Error ? err.message : err);
    }
  }

  const { data, error } = await supabaseAdmin
    .from('holdings')
    .select('*')
    .eq('user_id', user.id)
    .order('market_value', { ascending: false });

  if (error) {
    console.error('[positions] Supabase read failed:', error.message);
    return NextResponse.json({ error: 'Failed to load holdings' }, { status: 500 });
  }

  return NextResponse.json({ holdings: (data ?? []) as SyncedHolding[], source: 'simulated' });
}
