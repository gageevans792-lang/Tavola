import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getAccount, getPositions, getTickerPrices } from '@/lib/alpaca/client';
import { isFounder } from '@/lib/founder';
import { computeHarvestOpportunities, saveHarvestOpportunities, getTaxSettings } from '@/lib/tax/harvest';

function isCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    return req.headers.get('authorization') === `Bearer ${secret}`;
  }
  return req.headers.get('x-vercel-cron') === '1';
}

async function scanForUser(userId: string, isFounderUser: boolean) {
  const taxSettings = await getTaxSettings(userId);
  const stateRate   = taxSettings.state_tax_enabled ? taxSettings.state_tax_rate : 0;

  let positions: Array<{
    symbol: string; qty: string; avg_entry_price: string;
    unrealized_pl?: string; unrealized_plpc?: string; market_value?: string;
  }> = [];
  let prices: Record<string, number> = {};

  if (isFounderUser) {
    try {
      positions = await getPositions();
      const tickers = positions.map((p) => p.symbol);
      if (tickers.length > 0) {
        const priceData = await getTickerPrices(tickers);
        for (const [t, d] of Object.entries(priceData)) prices[t] = d.price;
      }
    } catch (err) {
      console.error('[tax/harvest-scan] alpaca error:', err);
      return { scanned: 0, opportunities: 0 };
    }
  } else {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: rows } = await admin
      .from('synced_holdings')
      .select('ticker, qty, avg_entry_price, market_value')
      .eq('user_id', userId);
    if (!rows?.length) return { scanned: 0, opportunities: 0 };

    positions = rows.map((r) => ({
      symbol:          r.ticker,
      qty:             String(r.qty),
      avg_entry_price: String(r.avg_entry_price),
      market_value:    String(r.market_value),
    }));

    const tickers = positions.map((p) => p.symbol);
    const priceData = await getTickerPrices(tickers);
    for (const [t, d] of Object.entries(priceData)) prices[t] = d.price;
  }

  const opportunities = await computeHarvestOpportunities(
    userId, positions, prices,
    taxSettings.marginal_rate, stateRate,
  );

  await saveHarvestOpportunities(userId, opportunities);
  return { scanned: positions.length, opportunities: opportunities.length };
}

// ── GET: cron-protected weekly scan (scans founder account) ──────────────────

export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const founderId = process.env.FOUNDER_USER_ID;
  if (!founderId) {
    return NextResponse.json({ error: 'FOUNDER_USER_ID not set' }, { status: 500 });
  }

  const result = await scanForUser(founderId, true);
  return NextResponse.json({ ok: true, ...result });
}

// ── POST: on-demand scan for authenticated user ──────────────────────────────

export async function POST(_req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('email').eq('id', user.id).maybeSingle();
  const isFounderUser = isFounder(user.id, profile?.email);

  try {
    const result = await scanForUser(user.id, isFounderUser);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[tax/harvest-scan POST]', err);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
