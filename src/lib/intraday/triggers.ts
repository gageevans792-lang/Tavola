import { getTickerPrices, getDailyBars } from '@/lib/alpaca/client';
import { getSentimentScores } from '@/lib/sentiment/engine';
import type { SentimentScore } from '@/lib/sentiment/engine';

export interface IntradayTrigger {
  type:     'vix_spike' | 'position_move' | 'sector_divergence' | 'sentiment_drop';
  ticker?:  string;
  detail:   string;
  severity: 'high' | 'medium';
}

export interface IntradayContext {
  triggers:        IntradayTrigger[];
  spyChangePct:    number;
  vixyChangePct:   number;
  positionChanges: Record<string, number>;
  sentimentScores: Record<string, SentimentScore>;
  currentPrices:   Record<string, number>;
  priorCloses:     Record<string, number>;
}

const SECTOR_ETFS = new Set([
  'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLRE',
]);

export async function evaluateTriggers(heldTickers: string[]): Promise<IntradayContext> {
  const marketTickers = ['SPY', 'VIXY'];
  const allTickers    = [...new Set([...marketTickers, ...heldTickers])];

  // Fetch current prices and prior-close bars in parallel
  const [pricesMap, ...barArrays] = await Promise.all([
    getTickerPrices(allTickers),
    ...allTickers.map((t) => getDailyBars(t, 4).catch((): { date: string; close: number }[] => [])),
  ]);

  const currentPrices: Record<string, number> = {};
  for (const [t, info] of Object.entries(pricesMap)) {
    currentPrices[t] = info.price;
  }

  const priorCloses: Record<string, number> = {};
  allTickers.forEach((t, i) => {
    const bars = barArrays[i] as { date: string; close: number }[];
    // bars sorted ascending — prior close is second-to-last completed day
    priorCloses[t] = bars.length >= 2 ? bars[bars.length - 2].close : 0;
  });

  function intradayPct(t: string): number {
    const cur  = currentPrices[t] ?? 0;
    const prev = priorCloses[t]   ?? 0;
    return prev > 0 ? ((cur - prev) / prev) * 100 : 0;
  }

  const spyChangePct  = intradayPct('SPY');
  const vixyChangePct = intradayPct('VIXY');

  const positionChanges: Record<string, number> = {};
  for (const t of heldTickers) positionChanges[t] = intradayPct(t);

  const sentimentScores = await getSentimentScores(heldTickers).catch(
    (): Record<string, SentimentScore> => ({}),
  );

  const triggers: IntradayTrigger[] = [];

  // ── Trigger 1: VIX spike ≥15% intraday ──────────────────────────────────────
  if (vixyChangePct >= 15) {
    triggers.push({
      type:     'vix_spike',
      detail:   `VIXY +${vixyChangePct.toFixed(1)}% intraday — elevated market fear`,
      severity: 'high',
    });
  }

  // ── Trigger 2: Position ±5% intraday ────────────────────────────────────────
  for (const t of heldTickers) {
    const chg = positionChanges[t] ?? 0;
    if (Math.abs(chg) >= 5) {
      triggers.push({
        type:     'position_move',
        ticker:   t,
        detail:   `${t} ${chg > 0 ? '+' : ''}${chg.toFixed(1)}% intraday`,
        severity: Math.abs(chg) >= 8 ? 'high' : 'medium',
      });
    }
  }

  // ── Trigger 3: Sector ETF diverging >2% from SPY ─────────────────────────────
  for (const t of heldTickers) {
    if (SECTOR_ETFS.has(t)) {
      const div = Math.abs((positionChanges[t] ?? 0) - spyChangePct);
      if (div > 2) {
        triggers.push({
          type:     'sector_divergence',
          ticker:   t,
          detail:   `${t} diverging ${div.toFixed(1)}% from SPY (sector rotation signal)`,
          severity: 'medium',
        });
      }
    }
  }

  // ── Trigger 4: Sentiment score below -40 ─────────────────────────────────────
  for (const t of heldTickers) {
    const s = sentimentScores[t];
    if (s && s.overall_score < -40) {
      triggers.push({
        type:     'sentiment_drop',
        ticker:   t,
        detail:   `${t} sentiment score ${s.overall_score} (threshold -40)`,
        severity: 'high',
      });
    }
  }

  return {
    triggers,
    spyChangePct,
    vixyChangePct,
    positionChanges,
    sentimentScores,
    currentPrices,
    priorCloses,
  };
}
