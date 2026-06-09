const BASE = 'https://finnhub.io/api/v1';

function token(): string {
  return process.env.FINNHUB_API_KEY ?? '';
}

function url(path: string, params: Record<string, string> = {}): string {
  const p = new URLSearchParams({ ...params, token: token() });
  return `${BASE}${path}?${p}`;
}

async function finnhubFetch<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url(path, params), { next: { revalidate: 300 } });
    if (!res.ok) {
      console.warn(`[finnhub] ${path} returned ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[finnhub] ${path} error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface FinnhubNewsItem {
  id:       number;
  category: string;
  datetime: number;  // Unix seconds
  headline: string;
  image:    string;
  related:  string;  // comma-separated tickers or empty
  source:   string;
  summary:  string;
  url:      string;
}

export interface FinnhubEarningsEvent {
  date:              string;   // "YYYY-MM-DD"
  symbol:            string;
  hour:              string;   // 'bmo' | 'amc' | 'dmh'
  quarter:           number;
  year:              number;
  epsEstimate:       number | null;
  revenueEstimate:   number | null;
}

export interface FinnhubEconomicEvent {
  actual:   number | null;
  country:  string;
  estimate: number | null;
  event:    string;
  impact:   'high' | 'medium' | 'low';
  period:   string;
  prev:     number | null;
  time:     string;   // "YYYY-MM-DD HH:MM:SS"
  unit:     string;
}

export interface FinnhubSentiment {
  buzz: { articlesInLastWeek: number; buzz: number; weeklyAverage: number };
  companyNewsScore: number;
  sectorAverageBullishPercent: number;
  sectorAverageNewsScore: number;
  sentiment: { bearishPercent: number; bullishPercent: number };
  symbol: string;
}

export interface FinnhubBasicFinancials {
  metric: {
    '52WeekHigh':          number;
    '52WeekLow':           number;
    beta:                  number;
    peBasicExclExtraTTM:   number;
    [key: string]:         unknown;
  };
  metricType: string;
  symbol: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Exported functions ────────────────────────────────────────────────────────

export async function getMarketNews(
  category: 'general' | 'forex' | 'crypto' | 'merger' = 'general',
): Promise<FinnhubNewsItem[]> {
  const data = await finnhubFetch<FinnhubNewsItem[]>('/news', { category });
  return (data ?? []).slice(0, 20);
}

export async function getCompanyNews(ticker: string): Promise<FinnhubNewsItem[]> {
  const today  = new Date();
  const sevenAgo = new Date(today.getTime() - 7 * 86_400_000);
  const data = await finnhubFetch<FinnhubNewsItem[]>('/company-news', {
    symbol: ticker,
    from:   isoDate(sevenAgo),
    to:     isoDate(today),
  });
  return (data ?? []).slice(0, 10);
}

export async function getEarningsCalendar(): Promise<FinnhubEarningsEvent[]> {
  const today = new Date();
  const inSeven = new Date(today.getTime() + 7 * 86_400_000);
  const data = await finnhubFetch<{ earningsCalendar: FinnhubEarningsEvent[] }>(
    '/calendar/earnings',
    { from: isoDate(today), to: isoDate(inSeven) },
  );
  return data?.earningsCalendar ?? [];
}

export async function getEconomicCalendar(): Promise<FinnhubEconomicEvent[]> {
  const data = await finnhubFetch<{ economicCalendar: FinnhubEconomicEvent[] }>(
    '/economic_calendar',
  );
  // Filter to US events only and exclude low-impact clutter
  return (data?.economicCalendar ?? []).filter(
    (e) => e.country === 'US' && e.impact !== 'low',
  );
}

export async function getSentiment(ticker: string): Promise<FinnhubSentiment | null> {
  return finnhubFetch<FinnhubSentiment>('/news-sentiment', { symbol: ticker });
}

export async function getBasicFinancials(ticker: string): Promise<FinnhubBasicFinancials | null> {
  return finnhubFetch<FinnhubBasicFinancials>('/stock/metric', {
    symbol: ticker,
    metric: 'all',
  });
}

export interface FinnhubIPO {
  date:              string;
  exchange:          string;
  name:              string;
  numberOfShares:    number;
  price:             string;
  status:            string;
  symbol:            string;
  totalSharesValue:  number;
}

export async function getIpoCalendar(from: string, to: string): Promise<FinnhubIPO[]> {
  const data = await finnhubFetch<{ ipoCalendar: FinnhubIPO[] }>(
    '/calendar/ipo',
    { from, to },
  );
  return data?.ipoCalendar ?? [];
}
