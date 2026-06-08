import { NextResponse } from 'next/server';
import Alpaca from '@alpacahq/alpaca-trade-api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Mover {
  symbol:    string;
  price:     number;
  change:    number;
  changePct: number;
  volume:    number;
}

export interface MoversResponse {
  gainers: Mover[];
  losers:  Mover[];
  as_of:   string;
}

// ── Tracked symbols ───────────────────────────────────────────────────────────

const TRACKED_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN',
  'META', 'TSLA', 'JPM',  'GS',   'MS',
  'BAC',  'V',    'MA',   'BRK.B','UNH',
  'JNJ',  'XOM',  'CVX',  'HD',   'WMT',
];

// ── In-process cache (60 seconds) ─────────────────────────────────────────────

interface CacheEntry {
  data:      MoversResponse;
  expiresAt: number;
}

let moversCache: CacheEntry | null = null;

// ── Alpaca client ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const alpaca = new Alpaca({
  keyId:     process.env.ALPACA_API_KEY!,
  secretKey: process.env.ALPACA_SECRET_KEY!,
  baseUrl:   process.env.ALPACA_BASE_URL ?? 'https://paper-api.alpaca.markets',
  paper:     process.env.ALPACA_PAPER !== 'false',
}) as any;

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const now = Date.now();

  if (moversCache && now < moversCache.expiresAt) {
    return NextResponse.json(moversCache.data);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = await alpaca.getSnapshots(TRACKED_SYMBOLS);

    const movers: Mover[] = [];

    if (Array.isArray(raw)) {
      for (const snap of raw) {
        const symbol: string = snap.symbol ?? snap.Symbol ?? '';
        if (!symbol) continue;

        // Current price: LatestTrade → DailyBar close → MinuteBar close
        const currentPrice: number =
          snap['LatestTrade']?.Price    ??
          snap['DailyBar']?.ClosePrice  ??
          snap['MinuteBar']?.ClosePrice ??
          0;

        // Previous close from prevDailyBar
        const prevClose: number =
          snap['PrevDailyBar']?.ClosePrice ??
          snap['prevDailyBar']?.ClosePrice  ??
          snap['prevDailyBar']?.c           ??
          0;

        const volume: number =
          snap['DailyBar']?.Volume    ??
          snap['DailyBar']?.v         ??
          snap['MinuteBar']?.Volume   ??
          0;

        if (currentPrice <= 0 || prevClose <= 0) continue;

        const change    = currentPrice - prevClose;
        const changePct = (change / prevClose) * 100;

        movers.push({ symbol, price: currentPrice, change, changePct, volume });
      }
    }

    // Sort by changePct
    movers.sort((a, b) => b.changePct - a.changePct);

    const gainers = movers.filter((m) => m.changePct >= 0).slice(0, 5);
    const losers  = movers.filter((m) => m.changePct < 0).slice(-5).reverse();

    const payload: MoversResponse = {
      gainers,
      losers,
      as_of: new Date().toISOString(),
    };

    moversCache = { data: payload, expiresAt: now + 60 * 1_000 };
    return NextResponse.json(payload);

  } catch (err) {
    console.error('[market/movers]', err instanceof Error ? err.message : err);
    // Return empty lists rather than crashing
    return NextResponse.json({ gainers: [], losers: [], as_of: new Date().toISOString() } satisfies MoversResponse);
  }
}
