import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DATA_BASE = 'https://data.alpaca.markets';

function alpacaHeaders(): HeadersInit {
  return {
    'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY!,
    'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY!,
  };
}

// ── Shared types ──────────────────────────────────────────────────────────────

export type NewsCategory = 'positions' | 'watchlist' | 'macro';

export interface NewsItem {
  id:           string;
  headline:     string;
  summary:      string;
  source:       string;
  url:          string;
  published_at: string;
  symbols:      string[];
  sentiment:    null;
  categories:   NewsCategory[];
}

// ── Alpaca news fetch (each call individually cached 5 min) ───────────────────

async function fetchAlpacaNews(params: URLSearchParams): Promise<NewsItem[]> {
  try {
    const res = await fetch(`${DATA_BASE}/v1beta1/news?${params}`, {
      headers: alpacaHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.warn('[market/news] Alpaca news fetch:', res.status, await res.text().catch(() => ''));
      return [];
    }
    const data = await res.json();
    return (data.news ?? []).map((item: Record<string, unknown>) => ({
      id:           String(item.id),
      headline:     String(item.headline ?? ''),
      summary:      String(item.summary  ?? ''),
      source:       String(item.source   ?? ''),
      url:          String(item.url      ?? ''),
      published_at: String(item.created_at ?? ''),
      symbols:      Array.isArray(item.symbols) ? item.symbols as string[] : [],
      sentiment:    null,
      categories:   [] as NewsCategory[],
    }));
  } catch (err) {
    console.warn('[market/news] fetch error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // User's tickers (holdings + watchlist) — these determine targeted news
  const [holdingsRes, watchlistRes] = await Promise.all([
    supabase.from('holdings').select('ticker').eq('user_id', user.id),
    supabase.from('user_watchlist').select('ticker').eq('user_id', user.id),
  ]);

  const holdingTickers  = new Set((holdingsRes.data  ?? []).map((h) => h.ticker as string));
  const watchlistTickers = new Set((watchlistRes.data ?? []).map((w) => w.ticker as string));
  const allTickers = new Set([...holdingTickers, ...watchlistTickers]);

  // Fetch targeted (user tickers) + general market news in parallel
  const fetches: Promise<NewsItem[]>[] = [];

  if (allTickers.size > 0) {
    fetches.push(
      fetchAlpacaNews(new URLSearchParams({
        limit:   '20',
        sort:    'desc',
        symbols: [...allTickers].join(','),
      })),
    );
  }

  fetches.push(
    fetchAlpacaNews(new URLSearchParams({ limit: '10', sort: 'desc' })),
  );

  const batches = await Promise.all(fetches);

  // Deduplicate by id, preserve order (targeted first)
  const seen = new Set<string>();
  const all: NewsItem[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        all.push(item);
      }
    }
  }

  // Sort newest first
  all.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  // Annotate categories so the client can filter without re-fetching
  for (const item of all) {
    const cats: NewsCategory[] = [];
    if (item.symbols.some((s) => holdingTickers.has(s)))  cats.push('positions');
    if (item.symbols.some((s) => watchlistTickers.has(s))) cats.push('watchlist');
    if (item.symbols.length === 0 || (!cats.includes('positions') && !cats.includes('watchlist'))) {
      cats.push('macro');
    }
    item.categories = cats;
  }

  return NextResponse.json(all);
}
