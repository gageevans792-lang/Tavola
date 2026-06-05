import { alpaca } from './client';

export interface MarketSnapshot {
  symbol: string;
  price: number;
  prevClose: number;
  dailyChangePct: number;
  volume: number;
}

// Alpaca snapshot shape (SDK ships as any, so we type what we use)
interface AlpacaSnapshot {
  latestTrade?: { p?: number };
  latestQuote?: { ap?: number; bp?: number };
  minuteBar?: { c?: number };
  dailyBar?: { v?: number };
  prevDailyBar?: { c?: number };
}

function extractPrice(snap: AlpacaSnapshot): number {
  return (
    snap.latestTrade?.p ??
    snap.latestQuote?.ap ??
    snap.minuteBar?.c ??
    0
  );
}

export async function getSnapshots(
  symbols: string[],
): Promise<Record<string, MarketSnapshot>> {
  if (symbols.length === 0) return {};

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await (alpaca as any).getSnapshots(symbols) as Record<string, AlpacaSnapshot>;

    const result: Record<string, MarketSnapshot> = {};

    for (const [symbol, snap] of Object.entries(raw)) {
      const price = extractPrice(snap);
      const prevClose = snap.prevDailyBar?.c ?? price;
      const dailyChangePct =
        prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

      result[symbol] = {
        symbol,
        price,
        prevClose,
        dailyChangePct,
        volume: snap.dailyBar?.v ?? 0,
      };
    }

    return result;
  } catch (err) {
    console.error('[market-data] getSnapshots failed:', err);
    return {};
  }
}
