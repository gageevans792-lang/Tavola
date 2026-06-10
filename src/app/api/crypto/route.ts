import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCryptoBars, placeCryptoOrder } from '@/lib/alpaca/client';
import type { TradeSide } from '@/types';

const CRYPTO_SYMBOLS = [
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'DOGE/USD', 'AVAX/USD', 'LINK/USD',
  'UNI/USD', 'AAVE/USD', 'LTC/USD', 'XRP/USD', 'MATIC/USD', 'DOT/USD',
];

export type { CryptoBar as CryptoPrice } from '@/lib/alpaca/client';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prices = await getCryptoBars(CRYPTO_SYMBOLS);
    return NextResponse.json(prices);
  } catch (err) {
    console.error('[crypto GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { symbol?: string; side?: string; notional?: number };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { symbol, side, notional } = body;
  if (!symbol || !side || !notional) {
    return NextResponse.json({ error: 'symbol, side, notional required' }, { status: 400 });
  }
  if (!['buy', 'sell'].includes(side)) {
    return NextResponse.json({ error: 'side must be buy or sell' }, { status: 400 });
  }
  if (notional < 1) {
    return NextResponse.json({ error: 'Minimum order is $1' }, { status: 400 });
  }

  try {
    const order = await placeCryptoOrder(symbol, side as TradeSide, notional);
    return NextResponse.json(order);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Order failed';
    console.error('[crypto POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
