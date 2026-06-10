import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/anthropic/client';
import { getAccount } from '@/lib/alpaca/client';
import { getEarningsCalendar, getEconomicCalendar } from '@/lib/finnhub/client';
import type { FinnhubEarningsEvent, FinnhubEconomicEvent } from '@/lib/finnhub/client';

const DATA_BASE = 'https://data.alpaca.markets';

function alpacaHeaders(): HeadersInit {
  return {
    'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY!,
    'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY!,
  };
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface MarketEvent {
  date:    string;
  title:   string;
  impact:  'high' | 'medium' | 'low';
  type:    'earnings' | 'macro' | 'geopolitical';
  ticker?: string;
}

export interface SignalsResponse {
  signals: {
    market_sentiment: string;
    your_portfolio:   string;
    top_opportunity:  string;
  };
  events: MarketEvent[];
  generated_at: string;
}

// ── Parse the three-line Claude response ─────────────────────────────────────

function parseSignals(text: string): SignalsResponse['signals'] {
  const extract = (label: string): string => {
    const match = text.match(new RegExp(`${label}:\\s*(.+)`, 'i'));
    return match ? match[1].trim() : '';
  };

  return {
    market_sentiment: extract('MARKET SENTIMENT'),
    your_portfolio:   extract('YOUR PORTFOLIO'),
    top_opportunity:  extract('TOP OPPORTUNITY'),
  };
}

// ── Build events array from Finnhub calendars ─────────────────────────────────

function buildEvents(
  earnings: FinnhubEarningsEvent[],
  economic: FinnhubEconomicEvent[],
): MarketEvent[] {
  const events: MarketEvent[] = [];

  for (const e of earnings.slice(0, 10)) {
    const timing = e.hour === 'bmo' ? 'BMO' : e.hour === 'amc' ? 'AMC' : '';
    events.push({
      date:   e.date,
      title:  `${e.symbol} Earnings${timing ? ` (${timing})` : ''}`,
      impact: 'high',
      type:   'earnings',
      ticker: e.symbol,
    });
  }

  for (const e of economic.slice(0, 10)) {
    events.push({
      date:   e.time.slice(0, 10),
      title:  e.event,
      impact: e.impact,
      type:   'macro',
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const newsController = new AbortController();
    const newsTimeout = setTimeout(() => newsController.abort(), 10_000);

    const [newsRes, holdingsRes, accountRes, earningsRes, economicRes] = await Promise.allSettled([
      fetch(`${DATA_BASE}/v1beta1/news?limit=30&sort=desc&start=${encodeURIComponent(since)}`, {
        headers: alpacaHeaders(),
        signal:  newsController.signal,
      }).finally(() => clearTimeout(newsTimeout)),
      supabase
        .from('holdings')
        .select('ticker, market_value, unrealized_pl, unrealized_plpc')
        .eq('user_id', user.id),
      getAccount(),
      getEarningsCalendar(),
      getEconomicCalendar(),
    ]);

    // Headlines
    let headlines = 'No recent headlines.';
    if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
      const d = await newsRes.value.json().catch(() => ({ news: [] }));
      const items = (d.news ?? []) as Array<{ headline: string; symbols: string[] }>;
      if (items.length > 0) {
        headlines = items.slice(0, 20)
          .map((n) => `${n.headline}${n.symbols.length ? ` [${n.symbols.slice(0, 2).join(',')}]` : ''}`)
          .join('\n');
      }
    }

    // Holdings
    const holdings = holdingsRes.status === 'fulfilled' ? (holdingsRes.value.data ?? []) : [];
    const holdingsSummary = holdings.length > 0
      ? holdings.map((h) => {
          const pct = parseFloat(h.unrealized_plpc).toFixed(1);
          return `${h.ticker} ($${Math.round(parseFloat(h.market_value)).toLocaleString()}, ${pct}%)`;
        }).join(', ')
      : 'No positions';

    // Equity
    const acct = accountRes.status === 'fulfilled' ? accountRes.value : null;
    const equity = acct
      ? `$${Math.round(parseFloat(acct.equity)).toLocaleString()}`
      : 'unknown';

    // Events
    const earnings = earningsRes.status === 'fulfilled' ? earningsRes.value : [];
    const economic = economicRes.status === 'fulfilled' ? economicRes.value : [];
    const events   = buildEvents(earnings, economic);

    const eventsSummary = events.length > 0
      ? 'Upcoming events:\n' + events.slice(0, 5).map((e) => `- ${e.date}: ${e.title}`).join('\n')
      : 'No upcoming events.';

    const userMessage =
      `Portfolio equity: ${equity}\nHoldings: ${holdingsSummary}\n\n${eventsSummary}\n\nHeadlines:\n${headlines}`;

    const aiResponse = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 200,
      system: `You are Tavola's Chief Investment Strategist. Generate exactly three atomic market signals, one sentence each, bold and specific. Never use em dashes (—) in your responses.

Output format (three lines only, no other text):
MARKET SENTIMENT: [one punchy sentence on today's market tone, max 15 words]
YOUR PORTFOLIO: [one sentence specific to the investor's actual holdings, max 15 words]
TOP OPPORTUNITY: [one specific actionable opportunity from the headlines, max 15 words]

Rules: Be direct, institutional, no hedging. No emojis. No extra text. Just the three labeled lines.`,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';
    const signals = parseSignals(rawText);

    if (!signals.market_sentiment) signals.market_sentiment = 'Market conditions require close monitoring today.';
    if (!signals.your_portfolio)   signals.your_portfolio   = 'Portfolio positioning reflects current market environment.';
    if (!signals.top_opportunity)  signals.top_opportunity  = 'Review watchlist for emerging setups.';

    return NextResponse.json({
      signals,
      events,
      generated_at: new Date().toISOString(),
    } satisfies SignalsResponse);
  } catch (err: unknown) {
    console.error('[market/brief]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
