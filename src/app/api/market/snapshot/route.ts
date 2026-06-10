import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Symbol manifests ──────────────────────────────────────────────────────────

const PULSE_SYMBOLS   = ['SPY', 'QQQ', 'DIA', 'VIXY', 'TLT'] as const;
const SECTOR_SYMBOLS  = ['XLK', 'XLV', 'XLF', 'XLE', 'XLY', 'XLI', 'XLU'] as const;

const LABELS: Record<string, string> = {
  // Pulse
  SPY:  'S&P 500',
  QQQ:  'NASDAQ',
  DIA:  'DOW',
  VIXY: 'VIX',
  TLT:  '10Y TREAS',
  // Sectors
  XLK:  'Technology',
  XLV:  'Healthcare',
  XLF:  'Financials',
  XLE:  'Energy',
  XLY:  'Consumer',
  XLI:  'Industrials',
  XLU:  'Utilities',
};

// ── Shared types ──────────────────────────────────────────────────────────────

export interface SnapshotTile {
  symbol:     string;
  label:      string;
  price:      number;
  change:     number;
  change_pct: number;
}

export interface SnapshotResponse {
  pulse:   SnapshotTile[];
  sectors: SnapshotTile[];
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allSymbols = [...PULSE_SYMBOLS, ...SECTOR_SYMBOLS];

  try {
    let res: Response;
    res = await fetch(
      `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${allSymbols.join(',')}`,
      {
        headers: {
          'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY!,
          'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY!,
        },
        signal: AbortSignal.timeout(8000),
        next:   { revalidate: 60 },
      },
    );

    if (!res.ok) {
      console.warn('[market/snapshot] Alpaca status:', res.status);
      return NextResponse.json(buildFallback());
    }

    const data = await res.json() as Record<string, unknown>;

    function toTile(sym: string): SnapshotTile {
      const snap = data[sym] as Record<string, Record<string, number>> | undefined;
      if (!snap) return { symbol: sym, label: LABELS[sym] ?? sym, price: 0, change: 0, change_pct: 0 };

      const price     = snap.latestTrade?.p ?? snap.dailyBar?.c ?? 0;
      const prevClose = snap.prevDailyBar?.c ?? 0;
      const change    = prevClose > 0 ? price - prevClose : 0;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return { symbol: sym, label: LABELS[sym] ?? sym, price, change, change_pct: changePct };
    }

    return NextResponse.json({
      pulse:   PULSE_SYMBOLS.map(toTile),
      sectors: SECTOR_SYMBOLS.map(toTile),
    } satisfies SnapshotResponse);

  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      console.error('[market/snapshot] request timeout');
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }
    console.warn('[market/snapshot] error:', err instanceof Error ? err.message : err);
    return NextResponse.json(buildFallback());
  }
}

function buildFallback(): SnapshotResponse {
  const empty = (sym: string): SnapshotTile => ({
    symbol: sym, label: LABELS[sym] ?? sym, price: 0, change: 0, change_pct: 0,
  });
  return {
    pulse:   [...PULSE_SYMBOLS].map(empty),
    sectors: [...SECTOR_SYMBOLS].map(empty),
  };
}
