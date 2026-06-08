import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Article {
  id:         string;
  headline:   string;
  summary:    string;
  url:        string;
  source:     string;
  created_at: string;
  symbols:    string[];
}

export interface NewsResponse {
  articles: Article[];
  cached:   boolean;
  as_of:    string;
}

// ── In-process cache (5 minutes) ──────────────────────────────────────────────

interface CacheEntry {
  data:      NewsResponse;
  expiresAt: number;
}

let newsCache: CacheEntry | null = null;

// ── Mock fallback ─────────────────────────────────────────────────────────────

function getMockArticles(): Article[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'mock-1',
      headline: 'Federal Reserve Signals Pause in Rate Hikes as Inflation Moderates',
      summary: 'Fed officials indicate a potential pause in the current rate-hiking cycle as recent data shows inflation cooling toward the 2% target. Markets rallied on the news.',
      url: 'https://www.wsj.com',
      source: 'Wall Street Journal',
      created_at: now,
      symbols: ['SPY', 'QQQ', 'TLT'],
    },
    {
      id: 'mock-2',
      headline: 'NVIDIA Reports Record Revenue Driven by AI Chip Demand',
      summary: 'NVIDIA posted quarterly revenue of $26B, up 122% year-over-year, as hyperscalers ramp AI infrastructure spending. Data center segment reached $22.6B.',
      url: 'https://www.bloomberg.com',
      source: 'Bloomberg',
      created_at: now,
      symbols: ['NVDA', 'AMD', 'INTC'],
    },
    {
      id: 'mock-3',
      headline: 'Apple Announces $110B Share Buyback Program, Beats Q2 Estimates',
      summary: "Apple's services revenue hit a record $23.9B while iPhone sales declined slightly year-over-year. The company authorized its largest-ever buyback.",
      url: 'https://www.reuters.com',
      source: 'Reuters',
      created_at: now,
      symbols: ['AAPL'],
    },
    {
      id: 'mock-4',
      headline: 'Goldman Sachs Upgrades S&P 500 Year-End Target to 5,600',
      summary: 'Goldman equity strategists raised their S&P 500 target, citing stronger-than-expected corporate earnings and resilient consumer spending despite higher rates.',
      url: 'https://www.ft.com',
      source: 'Financial Times',
      created_at: now,
      symbols: ['GS', 'SPY'],
    },
    {
      id: 'mock-5',
      headline: 'Microsoft Azure Revenue Grows 31%, Powered by AI Integration',
      summary: "Azure cloud revenue accelerated growth driven by Copilot and OpenAI integrations. Microsoft's commercial remaining performance obligations hit $259B.",
      url: 'https://www.cnbc.com',
      source: 'CNBC',
      created_at: now,
      symbols: ['MSFT'],
    },
    {
      id: 'mock-6',
      headline: 'Oil Prices Decline as OPEC+ Production Increases Offset Demand Concerns',
      summary: 'Brent crude fell below $80 as OPEC+ members agreed to gradually unwind voluntary production cuts starting in Q4. Energy stocks came under pressure.',
      url: 'https://www.wsj.com',
      source: 'Wall Street Journal',
      created_at: now,
      symbols: ['XOM', 'CVX', 'USO'],
    },
    {
      id: 'mock-7',
      headline: 'JPMorgan Chase Reports Strong Q2 Earnings, Net Interest Income Beats',
      summary: "Jamie Dimon's bank posted $18.1B in net income for Q2, with net interest income of $22.9B beating consensus. Consumer banking deposits stabilized.",
      url: 'https://www.bloomberg.com',
      source: 'Bloomberg',
      created_at: now,
      symbols: ['JPM', 'BAC', 'WFC'],
    },
    {
      id: 'mock-8',
      headline: 'Amazon Web Services Growth Reaccelerates to 17% as AI Workloads Surge',
      summary: 'AWS revenue reached $25B in Q1, with CEO Andy Jassy noting a pipeline of AI-related deals is "gigantic." Operating margins expanded to 37.6%.',
      url: 'https://www.reuters.com',
      source: 'Reuters',
      created_at: now,
      symbols: ['AMZN'],
    },
    {
      id: 'mock-9',
      headline: 'Visa and Mastercard Reach $30B Settlement Over Swipe Fees',
      summary: 'The landmark settlement with merchants caps interchange fees for five years and allows merchants greater flexibility to steer customers toward cheaper payment methods.',
      url: 'https://www.ft.com',
      source: 'Financial Times',
      created_at: now,
      symbols: ['V', 'MA'],
    },
    {
      id: 'mock-10',
      headline: 'Tesla Cuts Model 3 and Model Y Prices in Major Markets for Third Time This Year',
      summary: "Tesla reduced prices in the US and Europe as competition from Chinese EV makers intensifies. Analysts cut margin estimates; shares fell 4% on the news.",
      url: 'https://www.cnbc.com',
      source: 'CNBC',
      created_at: now,
      symbols: ['TSLA'],
    },
  ];
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Serve from cache if still fresh
  const now = Date.now();
  if (newsCache && now < newsCache.expiresAt) {
    return NextResponse.json({ ...newsCache.data, cached: true });
  }

  try {
    const res = await fetch(
      'https://data.alpaca.markets/v1beta1/news?limit=20&sort=desc',
      {
        headers: {
          'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY!,
          'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY!,
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      throw new Error(`Alpaca news API responded with ${res.status}`);
    }

    const json = await res.json();
    const raw: Array<{
      id:         number;
      headline:   string;
      summary:    string;
      url:        string;
      source:     string;
      created_at: string;
      symbols:    string[];
    }> = Array.isArray(json.news) ? json.news : Array.isArray(json) ? json : [];

    const articles: Article[] = raw.map((item) => ({
      id:         String(item.id),
      headline:   item.headline  ?? '',
      summary:    item.summary   ?? '',
      url:        item.url       ?? '',
      source:     item.source    ?? '',
      created_at: item.created_at ?? new Date().toISOString(),
      symbols:    Array.isArray(item.symbols) ? item.symbols : [],
    }));

    const payload: NewsResponse = {
      articles,
      cached: false,
      as_of:  new Date().toISOString(),
    };

    newsCache = { data: payload, expiresAt: now + 5 * 60 * 1_000 };
    return NextResponse.json(payload);

  } catch (err) {
    console.warn('[market/news] Alpaca fetch failed, using mock data:', err instanceof Error ? err.message : err);

    const payload: NewsResponse = {
      articles: getMockArticles(),
      cached:   false,
      as_of:    new Date().toISOString(),
    };

    // Cache mock data for 1 minute
    newsCache = { data: payload, expiresAt: now + 60 * 1_000 };
    return NextResponse.json(payload);
  }
}
