import { NextResponse } from 'next/server';
import { getIpoCalendar } from '@/lib/finnhub/client';
import type { FinnhubIPO } from '@/lib/finnhub/client';

export type { FinnhubIPO };

export async function GET() {
  try {
    const today  = new Date();
    const future = new Date(today.getTime() + 30 * 86_400_000);
    const from   = today.toISOString().slice(0, 10);
    const to     = future.toISOString().slice(0, 10);

    const ipos = await getIpoCalendar(from, to);
    return NextResponse.json({ ipos });
  } catch (err) {
    console.error('[ipo GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ipos: [] });
  }
}
