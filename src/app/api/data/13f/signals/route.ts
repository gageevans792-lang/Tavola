import { NextRequest, NextResponse } from 'next/server';
import { get13FSignals, getTopInstitutionalBuys } from '@/lib/13f/signals';

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker');
  const top    = req.nextUrl.searchParams.get('top');

  if (top) {
    const limit  = Math.min(parseInt(top, 10) || 5, 20);
    const result = await getTopInstitutionalBuys(limit);
    return NextResponse.json(result);
  }

  if (ticker) {
    const tickers = ticker.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
    const signals = await get13FSignals(tickers);
    return NextResponse.json(signals);
  }

  return NextResponse.json({ error: 'ticker or top param required' }, { status: 400 });
}
