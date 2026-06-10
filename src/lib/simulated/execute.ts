import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

const BASELINE_CASH = 100_000;

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export interface SimulatedFill {
  id:         string;
  symbol:     string;
  side:       'buy' | 'sell';
  qty:        number;
  fill_price: number;
  notional:   number;
  cash_after: number;
  simulated:  true;
}

export type SimulatedResult =
  | { ok: true;  fill: SimulatedFill }
  | { ok: false; error: { code: string; message: string } };

export async function executeSimulatedTrade(
  userId:        string,
  symbol:        string,
  side:          'buy' | 'sell',
  qty:           number,
  pricePerShare: number,
  opts?: { ai_reasoning?: string; confidence_score?: number },
): Promise<SimulatedResult> {
  const supabase = adminClient();

  // ── 1. Get current cash ────────────────────────────────────────────────────
  let cash = BASELINE_CASH;
  const { data: acct } = await supabase
    .from('user_accounts')
    .select('cash')
    .eq('user_id', userId)
    .maybeSingle();

  if (acct) {
    cash = Number(acct.cash);
  } else {
    // First trade ever — initialise account row
    await supabase.from('user_accounts').insert({ user_id: userId, cash: BASELINE_CASH });
  }

  const notional = qty * pricePerShare;

  // ── 2. Validate ────────────────────────────────────────────────────────────
  if (side === 'buy' && notional > cash) {
    return {
      ok: false,
      error: {
        code:    'INSUFFICIENT_FUNDS',
        message: `Insufficient cash. Need $${notional.toFixed(2)}, have $${cash.toFixed(2)}.`,
      },
    };
  }

  if (side === 'sell') {
    const { data: holding } = await supabase
      .from('holdings')
      .select('qty')
      .eq('user_id', userId)
      .eq('ticker', symbol)
      .maybeSingle();

    if (!holding || Number(holding.qty) < qty - 0.0001) {
      return {
        ok: false,
        error: {
          code:    'INSUFFICIENT_SHARES',
          message: `Insufficient shares. Need ${qty}, have ${holding ? Number(holding.qty) : 0}.`,
        },
      };
    }
  }

  // ── 3. Record trade ────────────────────────────────────────────────────────
  const { data: tradeRow, error: tradeErr } = await supabase
    .from('trades')
    .insert({
      user_id:          userId,
      ticker:           symbol,
      side,
      qty,
      price:            pricePerShare,
      status:           'filled',
      simulated:        true,
      ai_reasoning:     opts?.ai_reasoning   ?? null,
      confidence_score: opts?.confidence_score ?? null,
    })
    .select('id')
    .single();

  if (tradeErr) {
    console.error('[simulated/execute] trade insert:', tradeErr.message);
    return { ok: false, error: { code: 'DB_ERROR', message: 'Failed to record trade.' } };
  }

  // ── 4. Upsert holding ──────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('holdings')
    .select('qty, avg_entry_price')
    .eq('user_id', userId)
    .eq('ticker', symbol)
    .maybeSingle();

  if (side === 'buy') {
    const oldQty = existing ? Number(existing.qty) : 0;
    const oldAvg = existing ? Number(existing.avg_entry_price) : pricePerShare;
    const newQty = oldQty + qty;
    const newAvg = (oldQty * oldAvg + qty * pricePerShare) / newQty;
    const mv     = newQty * pricePerShare;
    const upl    = (pricePerShare - newAvg) * newQty;
    const uplpc  = newAvg > 0 ? ((pricePerShare - newAvg) / newAvg) * 100 : 0;

    await supabase.from('holdings').upsert(
      {
        user_id:         userId,
        ticker:          symbol,
        name:            symbol,
        qty:             newQty,
        avg_entry_price: newAvg,
        current_price:   pricePerShare,
        market_value:    mv,
        unrealized_pl:   upl,
        unrealized_plpc: uplpc,
        weight_pct:      0,
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'user_id,ticker' },
    );
  } else {
    const oldQty = existing ? Number(existing.qty) : 0;
    const oldAvg = existing ? Number(existing.avg_entry_price) : pricePerShare;
    const newQty = oldQty - qty;

    if (newQty <= 0.0001) {
      await supabase.from('holdings')
        .delete()
        .eq('user_id', userId)
        .eq('ticker', symbol);
    } else {
      const mv    = newQty * pricePerShare;
      const upl   = (pricePerShare - oldAvg) * newQty;
      const uplpc = oldAvg > 0 ? ((pricePerShare - oldAvg) / oldAvg) * 100 : 0;

      await supabase.from('holdings').upsert(
        {
          user_id:         userId,
          ticker:          symbol,
          name:            symbol,
          qty:             newQty,
          avg_entry_price: oldAvg,
          current_price:   pricePerShare,
          market_value:    mv,
          unrealized_pl:   upl,
          unrealized_plpc: uplpc,
          weight_pct:      0,
          updated_at:      new Date().toISOString(),
        },
        { onConflict: 'user_id,ticker' },
      );
    }
  }

  // ── 5. Update cash ─────────────────────────────────────────────────────────
  const cashAfter = side === 'buy' ? cash - notional : cash + notional;
  await supabase.from('user_accounts').upsert(
    { user_id: userId, cash: cashAfter, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );

  return {
    ok:   true,
    fill: {
      id:         tradeRow.id as string,
      symbol,
      side,
      qty,
      fill_price:  pricePerShare,
      notional,
      cash_after:  cashAfter,
      simulated:   true,
    },
  };
}
