import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Trade {
  id: string;
  user_id: string;
  ticker: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number | null;
  status: string;
  alpaca_order_id: string | null;
  ai_reasoning: string | null;
  created_at: string;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);

  const rawLimit  = parseInt(searchParams.get('limit')  ?? '50', 10);
  const rawOffset = parseInt(searchParams.get('offset') ?? '0',  10);

  const limit  = isNaN(rawLimit)  || rawLimit  < 1   ? 50  : Math.min(rawLimit, 100);
  const offset = isNaN(rawOffset) || rawOffset < 0   ? 0   : rawOffset;

  // Count total rows for the user
  const { count, error: countError } = await supabase
    .from('trades')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countError) {
    console.error('[trades GET] count:', countError.message);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('trades')
    .select('id, ticker, side, qty, price, status, alpaca_order_id, ai_reasoning, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[trades GET]', error.message);
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
  }

  return NextResponse.json({
    trades: (data ?? []) as Trade[],
    total:  count ?? 0,
  });
}
