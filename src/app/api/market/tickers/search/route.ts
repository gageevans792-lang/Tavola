import { NextRequest, NextResponse } from 'next/server';
import { getAssets, getAsset } from '@/lib/alpaca/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TickerSuggestion {
  symbol: string;
  name:   string;
}

// ── Server-side asset cache (24h TTL) ─────────────────────────────────────────
// Module-level — one cache per serverless instance. Best-effort dedup.

let assetCache: TickerSuggestion[] = [];
let cacheExpAt  = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000;

const VALID_TICKER_RE = /^[A-Z]{1,5}$/;

async function getOrFetchAssets(): Promise<TickerSuggestion[]> {
  if (Date.now() < cacheExpAt && assetCache.length > 0) return assetCache;

  const raw = await getAssets('us_equity');
  assetCache = raw
    .filter((a) => a.tradable && a.status === 'active')
    .map((a) => ({ symbol: a.symbol, name: a.name ?? a.symbol }));
  cacheExpAt = Date.now() + CACHE_TTL;
  return assetCache;
}

// ── GET /api/market/tickers/search?q= ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toUpperCase();
  if (!q) return NextResponse.json({ results: [] as TickerSuggestion[] });

  let assets: TickerSuggestion[];
  try {
    assets = await getOrFetchAssets();
  } catch {
    return NextResponse.json({ results: [] as TickerSuggestion[] });
  }

  // ── Match: symbol prefix first, then company-name substring ──────────────
  const bySymbol = assets.filter((a) => a.symbol.startsWith(q));
  const byName   = assets.filter(
    (a) => !a.symbol.startsWith(q) && a.name.toUpperCase().includes(q),
  );
  let results = [...bySymbol, ...byName].slice(0, 8);

  // ── Cache-bust for same-day IPOs ──────────────────────────────────────────
  // If the query looks like a valid ticker but isn't in cache, do a live lookup.
  const exactInResults = results.some((r) => r.symbol === q);
  if (!exactInResults && VALID_TICKER_RE.test(q)) {
    try {
      const live = await getAsset(q);
      if (live && live.tradable && live.status === 'active') {
        const entry: TickerSuggestion = { symbol: live.symbol, name: live.name ?? live.symbol };
        // Add to cache so future queries find it without another live lookup
        if (!assetCache.some((a) => a.symbol === live.symbol)) {
          assetCache.push(entry);
        }
        // Prepend the live-found ticker
        results = [entry, ...results].slice(0, 8);
      }
    } catch {
      // Live lookup failure is non-fatal
    }
  }

  return NextResponse.json({ results });
}
