import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getAccount, getPositions, getTickerPrices } from '@/lib/alpaca/client';
import { isFounder } from '@/lib/founder';

export async function GET() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── Non-founder: refresh holding prices from DATA API ────────────────────────
  if (!isFounder(user.id)) {
    const { data: holdings } = await supabaseAdmin
      .from('holdings')
      .select('ticker, qty, avg_entry_price')
      .eq('user_id', user.id);

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ synced: true, count: 0 });
    }

    try {
      const tickers = holdings.map((h: { ticker: string }) => h.ticker);
      const prices  = await getTickerPrices(tickers);

      for (const h of holdings as { ticker: string; qty: number; avg_entry_price: number }[]) {
        const info = prices[h.ticker];
        if (!info || info.price_unavailable || info.price <= 0) continue;

        const price  = info.price;
        const qty    = Number(h.qty);
        const avg    = Number(h.avg_entry_price);
        const mv     = qty * price;
        const upl    = (price - avg) * qty;
        const uplpc  = avg > 0 ? ((price - avg) / avg) * 100 : 0;

        await supabaseAdmin.from('holdings').update({
          current_price:   price,
          market_value:    mv,
          unrealized_pl:   upl,
          unrealized_plpc: uplpc,
          updated_at:      new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('ticker', h.ticker);
      }
    } catch (err) {
      console.warn('[sync/simulated] price refresh error:', err instanceof Error ? err.message : err);
    }

    return NextResponse.json({ synced: true, count: holdings.length });
  }

  // ── Founder: sync from Alpaca trading API ────────────────────────────────────
  // ── Fetch from Alpaca ────────────────────────────────────────────────────────
  console.log('[sync] Fetching account + positions for user', user.id);
  let account: Awaited<ReturnType<typeof getAccount>>;
  let positions: Awaited<ReturnType<typeof getPositions>>;

  try {
    [account, positions] = await Promise.all([getAccount(), getPositions()]);
    console.log('[sync] account equity =', account.equity, '| positions =', positions.length);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sync] Alpaca fetch failed:', msg);
    return NextResponse.json({ error: `Alpaca unavailable: ${msg}` }, { status: 503 });
  }

  const portValue = parseFloat(account.portfolio_value) || parseFloat(account.equity);

  // ── Upsert positions to Supabase via service role ────────────────────────────
  console.log('[sync] Upserting', positions.length, 'positions...');

  try {
    if (positions.length > 0) {
      for (const pos of positions) {
        const mv = parseFloat(pos.market_value);
        const row = {
          user_id:         user.id,
          ticker:          pos.symbol,
          name:            pos.symbol,
          qty:             parseFloat(pos.qty),
          avg_entry_price: parseFloat(pos.avg_entry_price),
          current_price:   parseFloat(pos.current_price || pos.avg_entry_price),
          market_value:    mv,
          unrealized_pl:   parseFloat(pos.unrealized_pl || '0'),
          unrealized_plpc: parseFloat(pos.unrealized_plpc || '0') * 100,
          weight_pct:      portValue > 0 ? (mv / portValue) * 100 : 0,
          updated_at:      new Date().toISOString(),
        };

        console.log('[sync] upserting', pos.symbol, 'qty=', row.qty, 'mv=', row.market_value);

        const { error } = await supabaseAdmin
          .from('holdings')
          .upsert(row, { onConflict: 'user_id,ticker' });

        if (error) {
          console.error('[sync] upsert failed for', pos.symbol, ':', error.message);
        } else {
          console.log('[sync] upserted', pos.symbol, 'OK');
        }
      }

      // Delete stale holdings no longer in Alpaca positions
      const currentTickers = positions.map((p) => p.symbol);
      const { error: deleteErr } = await supabaseAdmin
        .from('holdings')
        .delete()
        .eq('user_id', user.id)
        .not('ticker', 'in', `(${currentTickers.map((t) => `"${t}"`).join(',')})`);

      if (deleteErr) {
        console.warn('[sync] stale delete failed (non-fatal):', deleteErr.message);
      } else {
        console.log('[sync] stale holdings cleaned up');
      }
    } else {
      console.log('[sync] No positions — wiping holdings table for user', user.id);
      const { error } = await supabaseAdmin
        .from('holdings')
        .delete()
        .eq('user_id', user.id);

      if (error) console.error('[sync] wipe failed:', error.message);
    }

    console.log('[sync] Sync complete for user', user.id, '— count:', positions.length);
    return NextResponse.json({ synced: true, count: positions.length });
  } catch (err: unknown) {
    console.error('[sync]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
