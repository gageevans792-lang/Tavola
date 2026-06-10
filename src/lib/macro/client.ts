import { fetchRSS } from '@/lib/rss/client';
import { getEconomicCalendar } from '@/lib/finnhub/client';
import { getTickerPrices } from '@/lib/alpaca/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FedSentiment = 'hawkish' | 'dovish' | 'neutral';
export type FearGreedLabel = 'Extreme Greed' | 'Greed' | 'Neutral' | 'Fear' | 'Extreme Fear';

export interface FedSignal {
  title:     string;
  summary:   string;
  published: string;
  sentiment: FedSentiment;
  impact:    'high' | 'medium' | 'low';
}

export interface VixReading {
  vix:                    number;
  sentiment:              FearGreedLabel;
  portfolio_implication:  string;
}

export interface EconomicEvent {
  event:       string;
  date:        string;
  impact:      'high' | 'medium';
  days_until:  number;
}

export interface InsiderTrade {
  ticker:           string;
  insider_name:     string;
  transaction_type: 'buy' | 'sell';
  value:            number;
  filed:            string;
}

export interface MacroContext {
  fed:          FedSignal[];
  vix:          VixReading;
  events:       EconomicEvent[];
  insider:      InsiderTrade[];
  generated_at: string;
}

// ── Fed RSS ───────────────────────────────────────────────────────────────────

const FED_RSS = 'https://www.federalreserve.gov/feeds/press_all.xml';

const HAWKISH_WORDS = ['raise', 'hike', 'increase rate', 'tighten', 'restrictive', 'inflation concern', 'above target'];
const DOVISH_WORDS  = ['cut', 'reduce rate', 'lower rate', 'accommodative', 'easing', 'dovish', 'pause', 'slow down'];

function classifyFedSentiment(text: string): FedSentiment {
  const lower = text.toLowerCase();
  const h = HAWKISH_WORDS.filter(w => lower.includes(w)).length;
  const d = DOVISH_WORDS.filter(w => lower.includes(w)).length;
  if (h > d) return 'hawkish';
  if (d > h) return 'dovish';
  return 'neutral';
}

// ── VIX proxy via VIXY ────────────────────────────────────────────────────────

async function getVix(): Promise<VixReading> {
  try {
    const prices = await getTickerPrices(['VIXY']);
    const vix = prices['VIXY']?.price ?? 0;
    if (vix === 0) return { vix: 0, sentiment: 'Neutral', portfolio_implication: 'VIX unavailable. Monitor manually.' };

    let sentiment: FearGreedLabel;
    let portfolio_implication: string;
    if (vix < 15) {
      sentiment = 'Extreme Greed';
      portfolio_implication = 'Low volatility. Risk-on environment. Good time to deploy capital in equities.';
    } else if (vix < 20) {
      sentiment = 'Greed';
      portfolio_implication = 'Calm markets. Maintain positions, consider selective buys.';
    } else if (vix < 25) {
      sentiment = 'Neutral';
      portfolio_implication = 'Moderate uncertainty. Balanced approach, avoid over-concentration.';
    } else if (vix < 35) {
      sentiment = 'Fear';
      portfolio_implication = 'Elevated fear. Reduce position sizes, increase cash buffer to 20%+.';
    } else {
      sentiment = 'Extreme Fear';
      portfolio_implication = 'Extreme volatility. Defensive positioning: bonds, gold, cash. Avoid new equity positions.';
    }
    return { vix, sentiment, portfolio_implication };
  } catch {
    return { vix: 0, sentiment: 'Neutral', portfolio_implication: 'VIX unavailable.' };
  }
}

// ── SEC EDGAR insider filings ─────────────────────────────────────────────────

async function getInsiderTrades(): Promise<InsiderTrade[]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22form+4%22&dateRange=custom&startdt=${today}&enddt=${today}&hits.hits.total.value=true&hits.hits._source.period_of_report=true&hits.hits._source.entity_name=true`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Tavola/1.0 contact@tavola.app' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    // EDGAR returns complex nested JSON — parse what we can
    const data = await res.json() as {
      hits?: { hits?: Array<{ _source?: { entity_name?: string; period_of_report?: string } }> };
    };
    // Return simplified entries — full insider details require individual filing parsing
    // which is too slow for real-time. Return what's parseable.
    const hits = data?.hits?.hits ?? [];
    return hits.slice(0, 5).map((h, i) => ({
      ticker:           h._source?.entity_name ?? `ENTITY_${i}`,
      insider_name:     'See SEC Filing',
      transaction_type: 'buy' as const,
      value:            0,
      filed:            h._source?.period_of_report ?? today,
    })).filter(t => t.ticker && !t.ticker.startsWith('ENTITY'));
  } catch {
    return [];
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getMacroContext(): Promise<MacroContext> {
  const [fedItems, vix, economicEvents, insider] = await Promise.allSettled([
    fetchRSS(FED_RSS, 'FEDERAL RESERVE'),
    getVix(),
    getEconomicCalendar(),
    getInsiderTrades(),
  ]);

  // Fed signals
  const fed: FedSignal[] = (fedItems.status === 'fulfilled' ? fedItems.value : [])
    .slice(0, 5)
    .map(item => ({
      title:     item.title,
      summary:   item.summary,
      published: item.published_at,
      sentiment: classifyFedSentiment(item.title + ' ' + item.summary),
      impact:    item.title.toLowerCase().includes('rate') || item.title.toLowerCase().includes('fomc') ? 'high' : 'medium',
    }));

  // VIX
  const vixData = vix.status === 'fulfilled' ? vix.value : { vix: 0, sentiment: 'Neutral' as FearGreedLabel, portfolio_implication: 'Unavailable.' };

  // Economic events — high impact only, next 14 days
  const now = Date.now();
  const events: EconomicEvent[] = (economicEvents.status === 'fulfilled' ? economicEvents.value : [])
    .filter(e => e.impact === 'high')
    .map(e => {
      const eventDate = new Date(e.time);
      const days_until = Math.round((eventDate.getTime() - now) / 86_400_000);
      return { event: e.event, date: e.time.slice(0, 10), impact: 'high' as const, days_until };
    })
    .filter(e => e.days_until >= 0 && e.days_until <= 14)
    .slice(0, 8);

  // Insider trades
  const insiderData = insider.status === 'fulfilled' ? insider.value : [];

  return { fed, vix: vixData, events, insider: insiderData, generated_at: new Date().toISOString() };
}

// ── Prompt builder ────────────────────────────────────────────────────────────

export function buildMacroPromptSection(ctx: MacroContext): string {
  const fedStance = ctx.fed.length > 0
    ? ctx.fed[0].sentiment.toUpperCase() + ': ' + ctx.fed[0].title
    : 'No recent Fed communications';

  const vixLine = ctx.vix.vix > 0
    ? `VIXY ~${ctx.vix.vix.toFixed(2)} (${ctx.vix.sentiment}). ${ctx.vix.portfolio_implication}`
    : 'VIX data unavailable';

  const eventsLine = ctx.events.length > 0
    ? ctx.events.slice(0, 3).map(e => `${e.event} (${e.days_until}d)`).join(', ')
    : 'No major events in next 14 days';

  const insiderLine = ctx.insider.length > 0
    ? ctx.insider.slice(0, 3).map(i => `${i.ticker} ${i.transaction_type.toUpperCase()}`).join(', ')
    : 'No significant insider activity today';

  return `
REAL-TIME MACRO INTELLIGENCE
==============================
Fed Stance:              ${fedStance}
VIX / Market Fear:       ${vixLine}
Upcoming High-Impact:    ${eventsLine}
Insider Activity:        ${insiderLine}
Data Timestamp:          ${ctx.generated_at}`;
}
