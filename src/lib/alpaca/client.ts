import Alpaca from '@alpacahq/alpaca-trade-api';
import type {
  AlpacaAccount,
  AlpacaPosition,
  AlpacaOrder,
  TradeSide,
} from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const alpaca = new Alpaca({
  keyId:     process.env.ALPACA_API_KEY!,
  secretKey: process.env.ALPACA_SECRET_KEY!,
  baseUrl:   process.env.ALPACA_BASE_URL ?? 'https://paper-api.alpaca.markets',
  paper:     process.env.ALPACA_PAPER !== 'false',
}) as any;

export type PriceSource = 'snapshot' | 'latest_trade' | 'bar' | 'unavailable';

export interface TickerPrice {
  price:             number;
  price_source:      PriceSource;
  price_unavailable: boolean;
}

// The Alpaca SDK aliases field names to PascalCase after parsing:
//   latestTrade → LatestTrade  (with .Price from trade_mapping_v2 p→Price)
//   minuteBar   → MinuteBar    (with .ClosePrice from bar_mapping_v2 c→ClosePrice)
//   dailyBar    → DailyBar     (same)
// getSnapshots() returns an Array, not a keyed Record.

function extractSnapshotPrice(snap: Record<string, any>): number {
  return (
    snap['LatestTrade']?.Price    ??
    snap['DailyBar']?.ClosePrice  ??
    snap['MinuteBar']?.ClosePrice ??
    0
  );
}

export async function getTickerPrices(
  symbols: string[],
): Promise<Record<string, TickerPrice>> {
  if (symbols.length === 0) return {};

  const result: Record<string, TickerPrice> = {};
  for (const sym of symbols) {
    result[sym] = { price: 0, price_source: 'unavailable', price_unavailable: true };
  }

  // ── Step 1: snapshot API ────────────────────────────────────────────────────
  const needTrade: string[] = [];
  try {
    const raw: any[] = await alpaca.getSnapshots(symbols);
    const seen = new Set<string>();
    if (Array.isArray(raw)) {
      for (const snap of raw) {
        const sym: string = snap.symbol ?? snap.Symbol;
        if (!sym) continue;
        seen.add(sym);
        const price = extractSnapshotPrice(snap);
        if (price > 0) {
          result[sym] = { price, price_source: 'snapshot', price_unavailable: false };
        } else {
          needTrade.push(sym);
        }
      }
    }
    // Symbols absent from response also go to fallback
    for (const sym of symbols) {
      if (!seen.has(sym)) needTrade.push(sym);
    }
  } catch {
    needTrade.push(...symbols);
  }

  if (needTrade.length === 0) return result;

  // ── Step 2: latest trades ───────────────────────────────────────────────────
  const needBar: string[] = [];
  try {
    const tradesMap: Map<string, any> = await alpaca.getLatestTrades(needTrade);
    for (const sym of needTrade) {
      const trade = tradesMap.get(sym);
      // SDK aliases p → Price
      const price: number = trade?.Price ?? trade?.p ?? 0;
      if (price > 0) {
        result[sym] = { price, price_source: 'latest_trade', price_unavailable: false };
      } else {
        needBar.push(sym);
      }
    }
  } catch {
    needBar.push(...needTrade);
  }

  if (needBar.length === 0) return result;

  // ── Step 3: latest bars ─────────────────────────────────────────────────────
  try {
    const barsMap: Map<string, any> = await alpaca.getLatestBars(needBar);
    for (const sym of needBar) {
      const bar = barsMap.get(sym);
      // SDK aliases c → ClosePrice
      const price: number = bar?.ClosePrice ?? bar?.c ?? 0;
      if (price > 0) {
        result[sym] = { price, price_source: 'bar', price_unavailable: false };
      }
      // else stays unavailable
    }
  } catch {
    // prices remain unavailable for symbols that failed
  }

  return result;
}

export async function getAccount(): Promise<AlpacaAccount> {
  return alpaca.getAccount() as Promise<AlpacaAccount>;
}

export async function getPositions(): Promise<AlpacaPosition[]> {
  return alpaca.getPositions() as Promise<AlpacaPosition[]>;
}

export async function placeMarketOrder(
  ticker: string,
  side: TradeSide,
  qty: number,
): Promise<AlpacaOrder> {
  return alpaca.createOrder({
    symbol: ticker,
    qty,
    side,
    type: 'market',
    time_in_force: 'gtc',
  }) as Promise<AlpacaOrder>;
}

export async function getRecentOrders(limit = 50): Promise<AlpacaOrder[]> {
  return alpaca.getOrders({
    status:    'all',
    limit,
    until:     undefined,
    after:     undefined,
    direction: undefined,
    nested:    undefined,
    symbols:   undefined,
  }) as Promise<AlpacaOrder[]>;
}

export interface PortfolioHistory {
  timestamp:        number[];
  equity:           number[];
  profit_loss:      number[];
  profit_loss_pct:  number[];
  base_value:       number;
  timeframe:        string;
}

export async function getPortfolioHistory(params: {
  period?:    string;
  timeframe?: string;
}): Promise<PortfolioHistory> {
  return alpaca.getPortfolioHistory(params) as Promise<PortfolioHistory>;
}

export interface DailyBar {
  date:  string;
  close: number;
}

export async function getDailyBars(symbol: string, days: number): Promise<DailyBar[]> {
  try {
    const end = new Date();
    // Extra buffer for weekends / holidays: request 2× the calendar days needed
    const start = new Date(end.getTime() - Math.ceil(days * 2 + 10) * 24 * 60 * 60 * 1000);
    const bars: DailyBar[] = [];

    // getBarsV2 returns an async generator in Alpaca SDK v3.x
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gen = alpaca.getBarsV2(symbol, {
      start:     start.toISOString().slice(0, 10),
      end:       end.toISOString().slice(0, 10),
      timeframe: '1Day',
      limit:     days + 20,
      feed:      'iex',
    }) as AsyncIterable<Record<string, unknown>>;

    for await (const bar of gen) {
      // SDK maps raw fields to PascalCase; fall back to raw if needed
      const date  = String(bar['Timestamp'] ?? bar['t'] ?? '').slice(0, 10);
      const close = Number(bar['ClosePrice'] ?? bar['c'] ?? 0);
      if (close > 0 && date) bars.push({ date, close });
    }

    return bars.slice(-days);
  } catch {
    return [];
  }
}
