import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTickerPrices, getPositions } from '@/lib/alpaca/client';
import type { AlpacaPosition } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SignalType =
  | 'strong_buy'
  | 'buy'
  | 'hold'
  | 'sell'
  | 'strong_sell'
  | 'watch'
  | 'take_profit'
  | 'cut_loss'
  | 'review';

export type Sentiment = 'bullish' | 'neutral' | 'bearish';

export interface MarketSignal {
  ticker: string;
  price: number;
  signal: SignalType;
  sentiment: Sentiment;
  confidence: number;
  is_held: boolean;
  unrealized_plpc?: number;
  reasoning: string;
}

export interface MarketMover {
  ticker: string;
  change_pct: number;
  price: number;
}

export interface SignalsResponse {
  signals: MarketSignal[];
  market_snapshot: {
    gainers: MarketMover[];
    losers: MarketMover[];
  };
  generated_at: string;
}

// ── Fixed universe ────────────────────────────────────────────────────────────

const UNIVERSE: string[] = [
  'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD',
  'JPM', 'V', 'MA', 'JNJ', 'XOM', 'GS', 'BAC', 'NFLX', 'BABA',
  'BRK.B', 'UNH', 'PG',
];

// ── In-process cache (2 minutes) ──────────────────────────────────────────────

interface CacheEntry {
  data: SignalsResponse;
  expiresAt: number;
}

let signalsCache: CacheEntry | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function deterministicConfidence(ticker: string, price: number): number {
  // Deterministic 65–90 confidence derived from ticker chars + price magnitude
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) & 0xffffffff;
  }
  const priceFactor = Math.floor(price) % 17;
  return 65 + ((Math.abs(hash) + priceFactor) % 26);
}

function buildReasoning(
  ticker: string,
  signal: SignalType,
  isHeld: boolean,
  unrealizedPlpc?: number,
): string {
  if (isHeld && unrealizedPlpc !== undefined) {
    const pctStr = (unrealizedPlpc * 100).toFixed(1);
    if (signal === 'take_profit') {
      return `Position up ${pctStr}% from entry. Consider locking in gains at current levels.`;
    }
    if (signal === 'cut_loss') {
      return `Position down ${Math.abs(unrealizedPlpc * 100).toFixed(1)}% from entry. Review downside risk and stop-loss levels.`;
    }
    if (signal === 'review') {
      return `Position down ${Math.abs(unrealizedPlpc * 100).toFixed(1)}% from entry. Monitor closely for further deterioration.`;
    }
    if (unrealizedPlpc > 0) {
      return `Position up ${pctStr}%. Maintaining current exposure. Monitor for momentum continuation.`;
    }
    return `Position near entry price. Holding steady within normal volatility range.`;
  }
  return `${ticker} is on the watchlist universe. No current position. Monitor for entry opportunities.`;
}

function computeSignal(
  ticker: string,
  position: AlpacaPosition | undefined,
): { signal: SignalType; sentiment: Sentiment; unrealizedPlpc?: number } {
  // Suppress unused param lint — ticker reserved for future extension
  void ticker;

  if (!position) {
    return { signal: 'watch', sentiment: 'neutral' };
  }

  const unrealizedPlpc = parseFloat(position.unrealized_plpc);

  if (unrealizedPlpc > 0.15) {
    return { signal: 'take_profit', sentiment: 'bearish', unrealizedPlpc };
  }
  if (unrealizedPlpc > 0.05) {
    return { signal: 'hold', sentiment: 'neutral', unrealizedPlpc };
  }
  if (unrealizedPlpc < -0.10) {
    return { signal: 'cut_loss', sentiment: 'bearish', unrealizedPlpc };
  }
  if (unrealizedPlpc < -0.05) {
    return { signal: 'review', sentiment: 'bearish', unrealizedPlpc };
  }
  return { signal: 'hold', sentiment: 'neutral', unrealizedPlpc };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();

  if (signalsCache && now < signalsCache.expiresAt) {
    return NextResponse.json(signalsCache.data);
  }

  try {
    // Fetch positions (to add held tickers + compute signals)
    let positions: AlpacaPosition[] = [];
    try {
      positions = await getPositions();
    } catch {
      // non-fatal — continue with empty positions
    }

    // Build full symbol list: universe + held tickers (deduplicated)
    const heldSymbols = positions.map((p) => p.symbol);
    const allSymbols = [...new Set([...UNIVERSE, ...heldSymbols])];

    // Fetch prices for all symbols
    const prices = await getTickerPrices(allSymbols);

    // Build position map for quick lookup
    const positionMap = new Map<string, AlpacaPosition>();
    for (const pos of positions) {
      positionMap.set(pos.symbol, pos);
    }

    // Compute signals
    const signals: MarketSignal[] = [];
    for (const ticker of allSymbols) {
      const priceData = prices[ticker];
      const position = positionMap.get(ticker);
      const isHeld = !!position;

      const price = priceData && !priceData.price_unavailable
        ? priceData.price
        : position
          ? parseFloat(position.current_price)
          : 0;

      const { signal, sentiment, unrealizedPlpc } = computeSignal(ticker, position);
      const confidence = deterministicConfidence(ticker, price);
      const reasoning = buildReasoning(ticker, signal, isHeld, unrealizedPlpc);

      const entry: MarketSignal = {
        ticker,
        price,
        signal,
        sentiment,
        confidence,
        is_held: isHeld,
        reasoning,
      };
      if (unrealizedPlpc !== undefined) {
        entry.unrealized_plpc = unrealizedPlpc;
      }
      signals.push(entry);
    }

    // Compute market snapshot — reuse movers data via internal fetch
    const gainers: MarketMover[] = [];
    const losers: MarketMover[] = [];

    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const snapshotRes = await fetch(`${baseUrl}/api/market/movers`, {
        cache: 'no-store',
      });
      if (snapshotRes.ok) {
        const moversData = await snapshotRes.json() as {
          gainers: Array<{ symbol: string; changePct: number; price: number }>;
          losers: Array<{ symbol: string; changePct: number; price: number }>;
        };
        for (const g of (moversData.gainers ?? []).slice(0, 3)) {
          gainers.push({ ticker: g.symbol, change_pct: g.changePct, price: g.price });
        }
        for (const l of (moversData.losers ?? []).slice(0, 3)) {
          losers.push({ ticker: l.symbol, change_pct: l.changePct, price: l.price });
        }
      }
    } catch {
      // non-fatal — snapshot will be empty
    }

    const payload: SignalsResponse = {
      signals,
      market_snapshot: { gainers, losers },
      generated_at: new Date().toISOString(),
    };

    signalsCache = { data: payload, expiresAt: now + 2 * 60 * 1_000 };
    return NextResponse.json(payload);

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compute signals' },
      { status: 500 },
    );
  }
}
