import Alpaca from '@alpacahq/alpaca-trade-api';
import type {
  AlpacaAccount,
  AlpacaPosition,
  AlpacaOrder,
  AlpacaSnapshot,
  TradeSide,
} from '@/types';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY!,
  secretKey: process.env.ALPACA_SECRET_KEY!,
  baseUrl: process.env.ALPACA_BASE_URL ?? 'https://paper-api.alpaca.markets',
  paper: process.env.ALPACA_PAPER !== 'false',
});

export async function getAccount(): Promise<AlpacaAccount> {
  return alpaca.getAccount() as Promise<AlpacaAccount>;
}

export async function getPositions(): Promise<AlpacaPosition[]> {
  return alpaca.getPositions() as Promise<AlpacaPosition[]>;
}

export async function getSnapshots(
  symbols: string[],
): Promise<Record<string, AlpacaSnapshot>> {
  if (symbols.length === 0) return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (alpaca as any).getSnapshots(symbols) as Promise<Record<string, AlpacaSnapshot>>;
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
    time_in_force: 'day',
  }) as Promise<AlpacaOrder>;
}

export async function getRecentOrders(limit = 50): Promise<AlpacaOrder[]> {
  return alpaca.getOrders({
    status: 'all',
    limit,
    until: undefined,
    after: undefined,
    direction: undefined,
    nested: undefined,
    symbols: undefined,
  }) as Promise<AlpacaOrder[]>;
}
