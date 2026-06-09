import { getEarningsCalendarRange, getEarningsHistory } from '@/lib/finnhub/client';
import { getSentimentScore } from '@/lib/sentiment/engine';
import type { FinnhubEarningsEvent, FinnhubEarningResult } from '@/lib/finnhub/client';
import type { SentimentScore } from '@/lib/sentiment/engine';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EarningsIntelligence {
  ticker:                       string;
  earnings_date:                string;
  days_until:                   number;
  historical_beat_rate:         number;   // 0-100 %
  average_surprise_pct:         number;
  quarters_analyzed:            number;
  positioning_recommendation:   string;
  risk_level:                   'low' | 'medium' | 'high';
  pre_earnings_bias:            'bullish' | 'neutral' | 'bearish';
  size_guidance:                string;
}

// ── Core logic ────────────────────────────────────────────────────────────────

function buildIntelligence(
  event:     FinnhubEarningsEvent,
  history:   FinnhubEarningResult[],
  sentiment: SentimentScore | null,
): EarningsIntelligence {
  const today       = new Date();
  const earningsDay = new Date(event.date);
  const daysUntil   = Math.max(0, Math.round((earningsDay.getTime() - today.getTime()) / 86_400_000));

  const withSurprise  = history.filter((h) => h.surprise !== null && h.estimate !== null);
  const beats         = withSurprise.filter((h) => (h.surprise ?? 0) > 0);
  const beatRate      = withSurprise.length > 0 ? (beats.length / withSurprise.length) * 100 : 50;
  const avgSurprise   = withSurprise.length > 0
    ? withSurprise.reduce((s, h) => s + (h.surprisePercent ?? 0), 0) / withSurprise.length
    : 0;

  const sentScore    = sentiment?.overall_score ?? 0;
  const isHighBeater = beatRate >= 75;
  const isFreqMisser = beatRate < 50 && withSurprise.length >= 4;
  const nearEarnings = daysUntil <= 5;

  let preBias: EarningsIntelligence['pre_earnings_bias'] = 'neutral';
  let riskLevel: EarningsIntelligence['risk_level']       = 'medium';
  let recommendation: string;
  let sizeGuidance:   string;

  if (nearEarnings) {
    riskLevel    = 'high';
    sizeGuidance = `Size conservatively — earnings in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}; limit to 50% of normal position`;
  } else {
    sizeGuidance = 'Normal position sizing';
  }

  if (isHighBeater && sentScore > 20) {
    preBias       = 'bullish';
    recommendation = `${event.symbol} beats EPS estimates ${beatRate.toFixed(0)}% of the time with avg +${avgSurprise.toFixed(1)}% surprise. ` +
      `Positive sentiment (${sentScore > 0 ? '+' : ''}${sentScore}) confirms pre-earnings accumulation thesis.`;
  } else if (isFreqMisser && sentScore < -20) {
    preBias       = 'bearish';
    riskLevel     = 'high';
    recommendation = `${event.symbol} misses estimates ${(100 - beatRate).toFixed(0)}% of the time (${withSurprise.length} quarters). ` +
      `Negative sentiment (${sentScore}) supports reducing exposure before earnings.`;
  } else if (isHighBeater) {
    preBias       = 'bullish';
    recommendation = `${event.symbol} beats ${beatRate.toFixed(0)}% of the time. Neutral sentiment — hold current position into earnings.`;
  } else {
    recommendation = `${event.symbol}: ${beatRate.toFixed(0)}% historical beat rate. ` +
      (nearEarnings ? 'Earnings imminent — high event risk, size conservatively.' : 'Monitor sentiment into earnings.');
  }

  return {
    ticker:                     event.symbol,
    earnings_date:              event.date,
    days_until:                 daysUntil,
    historical_beat_rate:       Math.round(beatRate),
    average_surprise_pct:       Math.round(avgSurprise * 10) / 10,
    quarters_analyzed:          withSurprise.length,
    positioning_recommendation: recommendation,
    risk_level:                 riskLevel,
    pre_earnings_bias:          preBias,
    size_guidance:              sizeGuidance,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getUpcomingEarnings(
  tickers: string[],
): Promise<EarningsIntelligence[]> {
  if (!tickers.length) return [];

  const today    = new Date();
  const twoWeeks = new Date(today.getTime() + 14 * 86_400_000);
  const from     = today.toISOString().slice(0, 10);
  const to       = twoWeeks.toISOString().slice(0, 10);

  const calendar = await getEarningsCalendarRange(from, to).catch(() => [] as FinnhubEarningsEvent[]);
  const upcoming = calendar.filter((e) => tickers.includes(e.symbol));
  if (!upcoming.length) return [];

  const results = await Promise.allSettled(
    upcoming.map(async (event) => {
      const [histRes, sentRes] = await Promise.allSettled([
        getEarningsHistory(event.symbol),
        getSentimentScore(event.symbol),
      ]);
      const history   = histRes.status === 'fulfilled' ? histRes.value   : [];
      const sentiment = sentRes.status === 'fulfilled' ? sentRes.value   : null;
      return buildIntelligence(event, history, sentiment);
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<EarningsIntelligence> => r.status === 'fulfilled')
    .map((r) => r.value)
    .sort((a, b) => a.days_until - b.days_until);
}

export function buildEarningsPromptSection(earnings: EarningsIntelligence[]): string {
  if (!earnings.length) return '';

  const lines = earnings.map((e) =>
    `  ${e.ticker.padEnd(7)} earnings in ${e.days_until}d (${e.earnings_date}) — ` +
    `beat rate: ${e.historical_beat_rate}% over ${e.quarters_analyzed}Q, ` +
    `avg EPS surprise: ${e.average_surprise_pct > 0 ? '+' : ''}${e.average_surprise_pct}% — ` +
    `bias: ${e.pre_earnings_bias.toUpperCase()} — ${e.size_guidance}`,
  );

  return `
UPCOMING EARNINGS (within 14 days)
====================================
${lines.join('\n')}

Earnings rules:
• Earnings within 5 days = HIGH RISK EVENT — cut recommended position size by 50%
• Beat rate >75% + positive sentiment = favorable pre-earnings setup
• Miss rate >50% + negative sentiment = reduce before event
• Always note upcoming earnings date in reasoning for affected positions`;
}
