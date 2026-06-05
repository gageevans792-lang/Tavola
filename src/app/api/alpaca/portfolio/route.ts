import { NextResponse } from 'next/server';
import { getAccount, getPositions } from '@/lib/alpaca/client';

export async function GET() {
  const [account, positions] = await Promise.all([getAccount(), getPositions()]);

  const equity     = parseFloat(account.equity);
  const lastEquity = parseFloat(account.last_equity);
  const cash       = parseFloat(account.cash);
  const dayPl      = equity - lastEquity;

  return NextResponse.json({
    total_value:    equity,
    cash,
    equity:         equity - cash,
    day_pl:         dayPl,
    day_pl_percent: lastEquity > 0 ? (dayPl / lastEquity) * 100 : 0,
    positions,
  });
}
