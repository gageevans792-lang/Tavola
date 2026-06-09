import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMarketNews as getFinnhubNews } from '@/lib/finnhub/client';
import { fetchAllRssFeeds } from '@/lib/rss/client';
import type { FinnhubNewsItem } from '@/lib/finnhub/client';

const DATA_BASE = 'https://data.alpaca.markets';

function alpacaHeaders(): HeadersInit {
  return {
    'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY!,
    'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY!,
  };
}

// ── Shared types ──────────────────────────────────────────────────────────────

export type NewsCategory = 'positions' | 'watchlist' | 'macro' | 'geopolitical';

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
  data_source:  'alpaca' | 'finnhub' | 'rss';
}

// Legacy alias for backward compat
export type Article = NewsItem;

// ── Geopolitical keyword detection ────────────────────────────────────────────

const GEO_PATTERNS = [
  /\b(ukraine|russia[n]?|kremlin|zelensky|putin)\b/i,
  /\b(china|chinese|taiwan|hong kong|xi jinping|beijing)\b/i,
  /\b(iran|israel|hamas|hezbollah|middle east|gaza)\b/i,
  /\b(nato|g7|g20|un security council)\b/i,
  /\b(sanction|trade war|tariff war|export control|embargo)\b/i,
  /\b(geopolit|military|troops|airstrike|invasion|conflict)\b/i,
];

function isGeopolitical(headline: string, summary: string): boolean {
  const text = headline + ' ' + summary;
  return GEO_PATTERNS.some((re) => re.test(text));
}

// ── Alpaca news fetch ─────────────────────────────────────────────────────────

async function fetchAlpacaNews(params: URLSearchParams): Promise<NewsItem[]> {
  try {
    const res = await fetch(`${DATA_BASE}/v1beta1/news?${params}`, {
      headers: alpacaHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.warn('[market/news] Alpaca fetch:', res.status);
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
      data_source:  'alpaca' as const,
    }));
  } catch (err) {
    console.warn('[market/news] fetch error:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Finnhub normalizer ────────────────────────────────────────────────────────

function normalizeFinnhubNews(items: FinnhubNewsItem[]): NewsItem[] {
  return items.map((item) => ({
    id:           `fh-${item.id}`,
    headline:     item.headline,
    summary:      item.summary,
    source:       item.source,
    url:          item.url,
    published_at: new Date(item.datetime * 1000).toISOString(),
    symbols:      item.related
      ? item.related.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    sentiment:    null,
    categories:   [] as NewsCategory[],
    data_source:  'finnhub' as const,
  }));
}

// ── RSS normalizer ────────────────────────────────────────────────────────────

function normalizeRssNews(items: Awaited<ReturnType<typeof fetchAllRssFeeds>>): NewsItem[] {
  return items.map((item) => ({
    id:           item.id,
    headline:     item.title,
    summary:      item.summary,
    source:       item.source,
    url:          item.url,
    published_at: item.published_at,
    symbols:      [],
    sentiment:    null,
    categories:   [] as NewsCategory[],
    data_source:  'rss' as const,
  }));
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [holdingsRes, watchlistRes] = await Promise.all([
      supabase.from('holdings').select('ticker').eq('user_id', user.id),
      supabase.from('user_watchlist').select('ticker').eq('user_id', user.id),
    ]);

    const holdingTickers   = new Set((holdingsRes.data  ?? []).map((h) => h.ticker as string));
    const watchlistTickers = new Set((watchlistRes.data ?? []).map((w) => w.ticker as string));
    const allTickers       = new Set([...holdingTickers, ...watchlistTickers]);

    const [alpacaTargetedResult, alpacaGeneralResult, finnhubResult, rssResult] =
      await Promise.allSettled([
        allTickers.size > 0
          ? fetchAlpacaNews(new URLSearchParams({ limit: '20', sort: 'desc', symbols: [...allTickers].join(',') }))
          : Promise.resolve([] as NewsItem[]),
        fetchAlpacaNews(new URLSearchParams({ limit: '15', sort: 'desc' })),
        getFinnhubNews('general').then(normalizeFinnhubNews),
        fetchAllRssFeeds().then(normalizeRssNews),
      ]);

    const batches: NewsItem[][] = [
      alpacaTargetedResult.status === 'fulfilled' ? alpacaTargetedResult.value : [],
      alpacaGeneralResult.status  === 'fulfilled' ? alpacaGeneralResult.value  : [],
      finnhubResult.status        === 'fulfilled' ? finnhubResult.value        : [],
      rssResult.status            === 'fulfilled' ? rssResult.value            : [],
    ];

    // Dedup by id, then by 50-char headline prefix across sources
    const seenIds      = new Set<string>();
    const seenPrefixes = new Set<string>();
    const all: NewsItem[] = [];

    for (const batch of batches) {
      for (const item of batch) {
        if (!item.headline) continue;
        if (seenIds.has(item.id)) continue;
        const prefix = item.headline.toLowerCase().slice(0, 50);
        if (seenPrefixes.has(prefix)) continue;
        seenIds.add(item.id);
        seenPrefixes.add(prefix);
        all.push(item);
      }
    }

    all.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

    for (const item of all) {
      const cats: NewsCategory[] = [];
      if (item.symbols.some((s) => holdingTickers.has(s)))   cats.push('positions');
      if (item.symbols.some((s) => watchlistTickers.has(s))) cats.push('watchlist');
      if (isGeopolitical(item.headline, item.summary))        cats.push('geopolitical');
      if (cats.length === 0) cats.push('macro');
      item.categories = cats;
    }

    return NextResponse.json(all.slice(0, 40));
  } catch (err: unknown) {
    console.error('[market/news]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
