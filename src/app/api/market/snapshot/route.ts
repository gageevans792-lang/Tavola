import { NextResponse } from 'next/server';

const SYMBOLS = ['SPY', 'QQQ', 'DIA', 'VIXY'] as const;

const LABELS: Record<string, string> = {
  SPY:  'S&P 500',
  QQQ:  'NASDAQ',
  DIA:  'DOW',
  VIXY: 'VIX',
};

export interface SnapshotTile {
  symbol:     string;
  label:      string;
  price:      number;
  change:     number;
  change_pct: number;
}

export async function GET() {
  try {
    const res = await fetch(
      `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${SYMBOLS.join(',')}`,
      {
        headers: {
          'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY!,
          'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY!,
        },
        next: { revalidate: 60 },
      },
    );

    if (!res.ok) {
      console.warn('[market/snapshot] Alpaca snapshots:', res.status);
      return NextResponse.json(buildFallback());
    }

    const data = await res.json() as Record<string, unknown>;

    const tiles: SnapshotTile[] = SYMBOLS.map((sym) => {
      const snap = data[sym] as Record<string, Record<string, number>> | undefined;
      if (!snap) return { symbol: sym, label: LABELS[sym], price: 0, change: 0, change_pct: 0 };

      const price     = snap.latestTrade?.p ?? snap.dailyBar?.c ?? 0;
      const prevClose = snap.prevDailyBar?.c ?? 0;
      const change    = prevClose > 0 ? price - prevClose : 0;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return { symbol: sym, label: LABELS[sym], price, change, change_pct: changePct };
    });

    return NextResponse.json(tiles);
  } catch (err) {
    console.warn('[market/snapshot] error:', err instanceof Error ? err.message : err);
    return NextResponse.json(buildFallback());
  }
}

function buildFallback(): SnapshotTile[] {
  return SYMBOLS.map((sym) => ({
    symbol: sym, label: LABELS[sym], price: 0, change: 0, change_pct: 0,
  }));
}
