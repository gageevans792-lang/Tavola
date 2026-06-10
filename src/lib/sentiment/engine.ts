import { getDailyBars } from '@/lib/alpaca/client';
import {
  getCompanyNewsRange,
  getSocialSentiment,
  getInsiderTransactions,
  getRecommendations,
  getEarningsHistory,
} from '@/lib/finnhub/client';
import type {
  FinnhubNewsItem,
  FinnhubInsiderTransaction,
  FinnhubRecommendation,
  FinnhubSocialSentimentData,
  FinnhubInsiderTransactionsData,
  FinnhubEarningResult,
} from '@/lib/finnhub/client';
import type { DailyBar } from '@/lib/alpaca/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SentimentScore {
  ticker:          string;
  overall_score:   number;   // -100 to +100
  sentiment_label: 'Very Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Very Bearish';
  news_score:      number;
  social_score:    number;
  insider_score:   number;
  analyst_score:   number;
  momentum_score:  number;
  key_signals:     string[];
  risk_flags:      string[];
  confidence:      number;   // 0-100
  generated_at:    string;
}

export interface NarrativeShift {
  ticker:              string;
  narrative_direction: 'improving' | 'stable' | 'deteriorating';
  current_narrative:   string;
  previous_narrative:  string;
  shift_detected:      boolean;
  shift_description:   string;
}

// ── ETF registry ─────────────────────────────────────────────────────────────

const ETF_TICKERS = new Set([
  'VTI', 'VOO', 'SCHD', 'GLD', 'BND', 'QQQ', 'SPY', 'IWM', 'VNQ', 'VXUS',
  'IEMG', 'AGG', 'LQD', 'TLT', 'SHY', 'GDX', 'XLF', 'XLK', 'XLE', 'XLV',
  'XLP', 'XLY', 'XLI', 'XLB', 'XLU', 'XLRE', 'VIG', 'VYM', 'VCIT', 'VCSH',
  'VNQI', 'VGIT', 'VGLT', 'VTIP', 'BSV', 'BIV', 'BNDX', 'EMB', 'HYG', 'JNK',
  'ARKK', 'ARKG', 'ARKW', 'ARKF', 'ARKQ', 'DIA', 'MDY', 'IJH', 'IJR', 'VBK',
  'TQQQ', 'SQQQ', 'SPXL', 'UVXY', 'VXX', 'SOXL', 'SOXS', 'LABD', 'LABU',
]);

// ── Company name mapping ──────────────────────────────────────────────────────

const COMPANY_NAMES: Record<string, string[]> = {
  AAPL:  ['Apple', 'AAPL'],
  NVDA:  ['Nvidia', 'NVDA', 'Jensen Huang'],
  MSFT:  ['Microsoft', 'MSFT', 'Satya Nadella'],
  AMZN:  ['Amazon', 'AMZN', 'Andy Jassy'],
  GOOGL: ['Google', 'Alphabet', 'GOOGL'],
  GOOG:  ['Google', 'Alphabet', 'GOOG'],
  META:  ['Meta', 'Facebook', 'META', 'Zuckerberg'],
  TSLA:  ['Tesla', 'TSLA', 'Elon Musk'],
  NFLX:  ['Netflix', 'NFLX'],
  ORCL:  ['Oracle', 'ORCL'],
  AMD:   ['AMD', 'Advanced Micro', 'Lisa Su'],
  INTC:  ['Intel', 'INTC'],
  CRM:   ['Salesforce', 'CRM'],
  ADBE:  ['Adobe', 'ADBE'],
  NOW:   ['ServiceNow', 'NOW'],
  UBER:  ['Uber', 'UBER'],
  LYFT:  ['Lyft', 'LYFT'],
  SNAP:  ['Snap', 'Snapchat', 'SNAP'],
  SPOT:  ['Spotify', 'SPOT'],
  COIN:  ['Coinbase', 'COIN'],
  PLTR:  ['Palantir', 'PLTR'],
  SHOP:  ['Shopify', 'SHOP'],
  SQ:    ['Block', 'Square', 'SQ'],
  PYPL:  ['PayPal', 'PYPL'],
  JPM:   ['JPMorgan', 'JP Morgan', 'JPM'],
  GS:    ['Goldman Sachs', 'Goldman', 'GS'],
  MS:    ['Morgan Stanley', 'MS'],
  BAC:   ['Bank of America', 'BofA', 'BAC'],
  WFC:   ['Wells Fargo', 'WFC'],
};

function isRelevantArticle(headline: string, summary: string, ticker: string): boolean {
  const text  = `${headline} ${summary}`;
  const lower = text.toLowerCase();
  const terms = COMPANY_NAMES[ticker];
  if (terms) {
    return terms.some((term) => lower.includes(term.toLowerCase()));
  }
  // For unmapped tickers: require standalone word match
  return new RegExp(`\\b${ticker}\\b`, 'i').test(text);
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const scoreCache     = new Map<string, { data: SentimentScore; exp: number }>();
const narrativeCache = new Map<string, { data: NarrativeShift; exp: number }>();

const SCORE_TTL     = 15 * 60_000;
const NARRATIVE_TTL = 30 * 60_000;

// ── Keyword lists ─────────────────────────────────────────────────────────────

const POSITIVE_KW = [
  'beat', 'surge', 'rally', 'upgrade', 'outperform', 'record', 'growth',
  'strong', 'exceeds', 'raises', 'bullish', 'positive', 'profit', 'upside',
  'breakthrough', 'expands', 'accelerat',
];
const NEGATIVE_KW = [
  'miss', 'plunge', 'downgrade', 'underperform', 'cut', 'weak', 'disappoints',
  'layoffs', 'investigation', 'lawsuit', 'recalls', 'bearish', 'negative',
  'loss', 'warning', 'decline', 'fraud', 'breach', 'bankruptcy',
];

// ── Signal helpers ─────────────────────────────────────────────────────────────

function sourceWeight(source: string): number {
  const s = source.toLowerCase();
  if (s.includes('reuters') || s.includes('bloomberg')) return 1.0;
  if (s.includes('benzinga'))                            return 0.8;
  return 0.6;
}

function recencyWeight(unixSec: number): number {
  const hoursOld = (Date.now() - unixSec * 1000) / 3_600_000;
  if (hoursOld <= 2)  return 1.0;
  if (hoursOld <= 6)  return 0.8;
  if (hoursOld <= 12) return 0.6;
  return 0.4;
}

function scoreHeadline(headline: string): number {
  const text = headline.toLowerCase();
  let score = 0;
  for (const kw of POSITIVE_KW) if (text.includes(kw)) score++;
  for (const kw of NEGATIVE_KW) if (text.includes(kw)) score--;
  return Math.max(-1, Math.min(1, score));
}

// ── Signal 1: News ────────────────────────────────────────────────────────────

function computeNewsScore(
  news: FinnhubNewsItem[],
  cutoffHours = 24,
): { score: number; hasData: boolean; signals: string[]; flags: string[] } {
  const cutoff = Date.now() - cutoffHours * 3_600_000;
  const recent = news.filter((n) => n.datetime * 1000 >= cutoff);
  if (!recent.length) return { score: 0, hasData: false, signals: [], flags: [] };

  let wScore = 0;
  let wTotal = 0;
  const signals: string[] = [];
  const flags: string[]   = [];

  for (const a of recent) {
    const h  = scoreHeadline(a.headline);
    const rw = recencyWeight(a.datetime);
    const sw = sourceWeight(a.source);
    const w  = rw * sw;
    wScore  += h * w;
    wTotal  += w;

    if (h > 0 && sw >= 1.0 && signals.length < 2) {
      signals.push(`${a.source}: "${a.headline.slice(0, 70)}"`);
    }
    if (h < 0 && flags.length < 2) {
      flags.push(a.headline.slice(0, 80));
    }
  }

  const normalized = wTotal > 0 ? (wScore / wTotal) * 100 : 0;
  return {
    score:   Math.round(Math.max(-100, Math.min(100, normalized))),
    hasData: true,
    signals,
    flags,
  };
}

// ── Signal 2: Social ──────────────────────────────────────────────────────────

function computeSocialScore(
  data: FinnhubSocialSentimentData | null,
): { score: number; hasData: boolean; signals: string[] } {
  if (!data?.data?.length) return { score: 0, hasData: false, signals: [] };

  const entries = data.data.slice(0, 7);
  const totalMentions = entries.reduce((s, e) => s + (e.mention || 0), 0);
  const wScore        = entries.reduce((s, e) => s + (e.mention || 0) * (e.score || 0), 0);
  const avgScore      = totalMentions > 0 ? wScore / totalMentions : 0;

  // Normalize 0-1 → -100 to +100
  const normalized = (avgScore - 0.5) * 200;
  const signals: string[] = [];
  if (totalMentions > 50) {
    signals.push(`High social volume: ${totalMentions} mentions (Reddit/Twitter)`);
  }

  return {
    score:   Math.round(Math.max(-100, Math.min(100, normalized))),
    hasData: true,
    signals,
  };
}

// ── Signal 3: Insider activity ────────────────────────────────────────────────

function computeInsiderScore(
  data: FinnhubInsiderTransactionsData | null,
): { score: number; hasData: boolean; signals: string[]; flags: string[] } {
  if (!data?.data?.length) return { score: 0, hasData: false, signals: [], flags: [] };

  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
  const txns = (data.data as FinnhubInsiderTransaction[]).filter((t) => {
    const d = new Date(t.transactionDate || t.filingDate);
    return d.getTime() >= thirtyDaysAgo;
  });
  if (!txns.length) return { score: 0, hasData: false, signals: [], flags: [] };

  let buyValue  = 0;
  let sellValue = 0;
  const signals: string[] = [];
  const flags: string[]   = [];

  for (const t of txns) {
    const price = t.transactionPrice > 0 ? t.transactionPrice : 1;
    const value = Math.abs((t.change || t.share || 0) * price);
    if (t.transactionCode === 'P' || t.change > 0) {
      buyValue += value;
      if (value >= 500_000 && signals.length < 2) {
        signals.push(`Insider buy: ${t.name} purchased $${(value / 1000).toFixed(0)}K`);
      }
    } else if (t.transactionCode === 'S' || t.change < 0) {
      sellValue += value;
      if (value >= 1_000_000 && flags.length < 1) {
        flags.push(`Insider sell: ${t.name} sold $${(value / 1000).toFixed(0)}K`);
      }
    }
  }

  const net   = buyValue - sellValue;
  const total = buyValue + sellValue;
  const ratio = total > 0 ? net / total : 0;

  return {
    score:   Math.round(Math.max(-100, Math.min(100, ratio * 100))),
    hasData: true,
    signals,
    flags,
  };
}

// ── Signal 4: Analyst momentum ────────────────────────────────────────────────

function computeAnalystScore(
  recs: FinnhubRecommendation[],
): { score: number; hasData: boolean; signals: string[] } {
  if (!recs.length) return { score: 0, hasData: false, signals: [] };

  const cur  = recs[0];
  const prev = recs[1] ?? null;

  const curBull = (cur.buy || 0) + (cur.strongBuy || 0);
  const curBear = (cur.sell || 0) + (cur.strongSell || 0);
  const curTotal = curBull + curBear + (cur.hold || 0);

  const curRatio   = curTotal > 0 ? curBull / curTotal : 0.5;
  const absoluteS  = (curRatio - 0.5) * 100;

  let momentumS = 0;
  const signals: string[] = [];

  if (prev) {
    const prevBull = (prev.buy || 0) + (prev.strongBuy || 0);
    const prevBear = (prev.sell || 0) + (prev.strongSell || 0);
    const prevTotal = prevBull + prevBear + (prev.hold || 0);
    const prevRatio = prevTotal > 0 ? prevBull / prevTotal : 0.5;
    momentumS = (curRatio - prevRatio) * 200;

    if (curBull > prevBull) {
      signals.push(`Analyst upgrades: ${curBull} buys this month (was ${prevBull} last month)`);
    } else if (curBear > prevBear) {
      signals.push(`Analyst downgrades: ${curBear} sells this month (was ${prevBear} last month)`);
    }
  } else {
    if (curBull > curBear) signals.push(`${curBull} analyst buy ratings vs ${curBear} sells`);
  }

  const combined = absoluteS * 0.6 + momentumS * 0.4;
  return {
    score:   Math.round(Math.max(-100, Math.min(100, combined))),
    hasData: true,
    signals,
  };
}

// ── Signal 4b: Earnings surprise history ─────────────────────────────────────

function computeEarningsSurprise(results: FinnhubEarningResult[]): {
  scoreBonus: number;
  confidenceBonus: number;
  signals: string[];
} {
  const recent = results
    .filter((r) => r.actual !== null && r.estimate !== null)
    .slice(0, 4);

  if (recent.length < 2) return { scoreBonus: 0, confidenceBonus: 0, signals: [] };

  const beats = recent.filter((r) => (r.actual ?? 0) > (r.estimate ?? 0));
  const signals: string[] = [];
  let scoreBonus = 0;
  let confidenceBonus = 0;

  if (beats.length >= 3) {
    scoreBonus      = 10;
    confidenceBonus = 15;
    const avgSurp = recent
      .map((r) => r.surprisePercent ?? 0)
      .reduce((s, v) => s + v, 0) / recent.length;
    signals.push(`Beat EPS estimates ${beats.length}/${recent.length} qtrs (avg +${avgSurp.toFixed(1)}%)`);
  } else if (beats.length === 0 && recent.length >= 2) {
    scoreBonus = -5;
    signals.push(`Missed EPS estimates ${recent.length} consecutive quarters`);
  }

  return { scoreBonus, confidenceBonus, signals };
}

// ── Signal 5: Price momentum ──────────────────────────────────────────────────

function computeMomentumScore(
  bars: DailyBar[],
): { score: number; hasData: boolean; signals: string[] } {
  if (bars.length < 5) return { score: 0, hasData: false, signals: [] };

  const latest      = bars[bars.length - 1].close;
  const fiveDaysAgo = bars[Math.max(0, bars.length - 6)].close;
  const thirtyAgo   = bars[Math.max(0, bars.length - 31)].close;
  const high52w     = Math.max(...bars.slice(-252).map((b) => b.close));

  if (!latest) return { score: 0, hasData: false, signals: [] };

  const ret5d  = fiveDaysAgo > 0 ? ((latest - fiveDaysAgo) / fiveDaysAgo) * 100 : 0;
  const ret30d = thirtyAgo   > 0 ? ((latest - thirtyAgo)   / thirtyAgo)   * 100 : 0;
  const vsHigh = high52w     > 0 ? ((latest - high52w)     / high52w)     * 100 : 0;

  let score = 0;
  score += Math.max(-50, Math.min(50, ret5d  * 5));
  score += Math.max(-30, Math.min(30, ret30d * 1.5));
  score += vsHigh > -5  ? 20 : vsHigh > -15 ? 10 : 0;

  const signals: string[] = [];
  const ann5d  = ret5d  * (252 / 5);
  const ann30d = ret30d * (252 / 30);
  if (ret5d > 0 && ann5d > ann30d) {
    signals.push(`Momentum accelerating: +${ret5d.toFixed(1)}% (5d) vs +${ret30d.toFixed(1)}% (30d)`);
  } else if (ret5d < -1) {
    signals.push(`Price under pressure: ${ret5d.toFixed(1)}% (5d), ${ret30d.toFixed(1)}% (30d)`);
  }
  if (vsHigh > -5) {
    signals.push(`Trading near 52-week high (${vsHigh.toFixed(1)}% from peak)`);
  }

  return {
    score:   Math.round(Math.max(-100, Math.min(100, score))),
    hasData: true,
    signals,
  };
}

// ── Label from composite score ─────────────────────────────────────────────────

function scoreToLabel(score: number): SentimentScore['sentiment_label'] {
  if (score >= 60)  return 'Very Bullish';
  if (score >= 20)  return 'Bullish';
  if (score >= -20) return 'Neutral';
  if (score >= -60) return 'Bearish';
  return 'Very Bearish';
}

// ── Core scoring ──────────────────────────────────────────────────────────────

export async function getSentimentScore(ticker: string): Promise<SentimentScore> {
  const hit = scoreCache.get(ticker);
  if (hit && Date.now() < hit.exp) return hit.data;

  // ── ETF fast-path: skip company-specific signals ──────────────────────────
  if (ETF_TICKERS.has(ticker)) {
    const bars        = await getDailyBars(ticker, 260).catch(() => [] as DailyBar[]);
    const momentumSig = computeMomentumScore(bars);
    const confidence  = Math.min(100, 60 + (momentumSig.hasData ? 30 : 0));
    const result: SentimentScore = {
      ticker,
      overall_score:   momentumSig.score,
      sentiment_label: scoreToLabel(momentumSig.score),
      news_score:      0,
      social_score:    0,
      insider_score:   0,
      analyst_score:   0,
      momentum_score:  momentumSig.score,
      key_signals:     momentumSig.signals.slice(0, 3),
      risk_flags:      [],
      confidence,
      generated_at:    new Date().toISOString(),
    };
    scoreCache.set(ticker, { data: result, exp: Date.now() + SCORE_TTL });
    return result;
  }

  // ── Standard path: all 5 signals + earnings history ──────────────────────
  const today     = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const toDate    = today.toISOString().slice(0, 10);
  const fromDate  = yesterday.toISOString().slice(0, 10);

  const [newsRes, socialRes, insiderRes, recsRes, barsRes, earningsRes] = await Promise.allSettled([
    getCompanyNewsRange(ticker, fromDate, toDate),
    getSocialSentiment(ticker, fromDate),
    getInsiderTransactions(ticker),
    getRecommendations(ticker),
    getDailyBars(ticker, 260),
    getEarningsHistory(ticker),
  ]);

  const rawNews       = newsRes.status      === 'fulfilled' ? newsRes.value      : [];
  const social        = socialRes.status    === 'fulfilled' ? socialRes.value    : null;
  const insider       = insiderRes.status   === 'fulfilled' ? insiderRes.value   : null;
  const recs          = recsRes.status      === 'fulfilled' ? recsRes.value      : [];
  const bars          = barsRes.status      === 'fulfilled' ? barsRes.value      : [];
  const earningsHist  = earningsRes.status  === 'fulfilled' ? earningsRes.value  : [];

  // Relevance filter: only keep articles that mention the company by name or ticker
  const news = rawNews.filter((a) => isRelevantArticle(a.headline, a.summary ?? '', ticker));

  const newsSig     = computeNewsScore(news);
  const socialSig   = computeSocialScore(social);
  const insiderSig  = computeInsiderScore(insider);
  const analystSig  = computeAnalystScore(recs);
  const momentumSig = computeMomentumScore(bars);
  const earningsBon = computeEarningsSurprise(earningsHist);

  // Data-coverage confidence (capped at 100)
  let confidence = 0;
  if (momentumSig.hasData) confidence += 30;
  if (newsSig.hasData)     confidence += 20;
  if (socialSig.hasData)   confidence += 20;
  if (insiderSig.hasData)  confidence += 15;
  if (analystSig.hasData)  confidence += 15;
  confidence = Math.min(100, confidence + earningsBon.confidenceBonus);

  // Proportional weights (renormalized when signals missing)
  const rawW = {
    news:     newsSig.hasData     ? 0.30 : 0,
    momentum: momentumSig.hasData ? 0.25 : 0,
    analyst:  analystSig.hasData  ? 0.20 : 0,
    insider:  insiderSig.hasData  ? 0.15 : 0,
    social:   socialSig.hasData   ? 0.10 : 0,
  };
  const wTotal = Object.values(rawW).reduce((s, v) => s + v, 0) || 1;
  const w = Object.fromEntries(Object.entries(rawW).map(([k, v]) => [k, v / wTotal]));

  const baseScore = Math.round(
    newsSig.score     * w.news +
    momentumSig.score * w.momentum +
    analystSig.score  * w.analyst +
    insiderSig.score  * w.insider +
    socialSig.score   * w.social,
  );
  const overallScore = Math.round(Math.max(-100, Math.min(100, baseScore + earningsBon.scoreBonus)));

  const allSignals = [
    ...momentumSig.signals,
    ...newsSig.signals,
    ...insiderSig.signals,
    ...analystSig.signals,
    ...socialSig.signals,
    ...earningsBon.signals,
  ];
  const allFlags = [...newsSig.flags, ...insiderSig.flags];

  const result: SentimentScore = {
    ticker,
    overall_score:   overallScore,
    sentiment_label: scoreToLabel(overallScore),
    news_score:      newsSig.score,
    social_score:    socialSig.score,
    insider_score:   insiderSig.score,
    analyst_score:   analystSig.score,
    momentum_score:  momentumSig.score,
    key_signals:     allSignals.slice(0, 3),
    risk_flags:      allFlags.slice(0, 3),
    confidence,
    generated_at:    new Date().toISOString(),
  };

  scoreCache.set(ticker, { data: result, exp: Date.now() + SCORE_TTL });
  return result;
}

export async function getSentimentScores(
  tickers: string[],
): Promise<Record<string, SentimentScore>> {
  const results = await Promise.allSettled(tickers.map((t) => getSentimentScore(t)));
  const out: Record<string, SentimentScore> = {};
  tickers.forEach((t, i) => {
    if (results[i].status === 'fulfilled') out[t] = (results[i] as PromiseFulfilledResult<SentimentScore>).value;
  });
  return out;
}

// ── Narrative theme detection ─────────────────────────────────────────────────

const THEME_KEYWORDS: Record<string, string[]> = {
  'AI growth story':       ['ai', 'artificial intelligence', 'chatgpt', 'llm', 'machine learning', 'generative', 'nvidia', 'gpu'],
  'earnings beat cycle':   ['earnings', 'beat', 'eps', 'revenue', 'quarter', 'profit', 'guidance'],
  'regulatory concern':    ['regulatory', 'ftc', 'antitrust', 'investigation', 'sec', 'fine', 'lawsuit', 'probe'],
  'management change':     ['ceo', 'cfo', 'executive', 'resign', 'appoint', 'departure', 'leadership'],
  'market momentum':       ['rally', 'surge', 'high', 'bullish', 'uptrend', 'momentum', 'breakout'],
  'supply chain concerns': ['supply', 'inventory', 'shortage', 'delay', 'production', 'tariff'],
};

function detectTheme(headlines: string[]): string {
  const counts: Record<string, number> = {};
  for (const hl of headlines) {
    const text = hl.toLowerCase();
    for (const [theme, kws] of Object.entries(THEME_KEYWORDS)) {
      if (kws.some((kw) => text.includes(kw))) counts[theme] = (counts[theme] ?? 0) + 1;
    }
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top?.[1] ? top[0] : 'general market activity';
}

export async function detectNarrativeShift(ticker: string): Promise<NarrativeShift> {
  const hit = narrativeCache.get(ticker);
  if (hit && Date.now() < hit.exp) return hit.data;

  const today      = new Date();
  const sevenAgo   = new Date(today.getTime() -  7 * 86_400_000);
  const thirtyAgo  = new Date(today.getTime() - 30 * 86_400_000);
  const toDate     = today.toISOString().slice(0, 10);
  const from7d     = sevenAgo.toISOString().slice(0, 10);
  const from30d    = thirtyAgo.toISOString().slice(0, 10);

  const [res7d, res30d] = await Promise.allSettled([
    getCompanyNewsRange(ticker, from7d, toDate),
    getCompanyNewsRange(ticker, from30d, toDate),
  ]);

  const news7d  = (res7d.status  === 'fulfilled' ? res7d.value  : [])
    .filter((a) => isRelevantArticle(a.headline, a.summary ?? '', ticker));
  const news30d = (res30d.status === 'fulfilled' ? res30d.value : [])
    .filter((a) => isRelevantArticle(a.headline, a.summary ?? '', ticker));

  const avgScore = (articles: FinnhubNewsItem[]) => {
    if (!articles.length) return 0;
    const scores = articles.map((a) => scoreHeadline(a.headline));
    return scores.reduce((s, v) => s + v, 0) / scores.length * 100;
  };

  const score7d  = avgScore(news7d);
  const score30d = avgScore(news30d);
  const diff     = score7d - score30d;

  const direction: NarrativeShift['narrative_direction'] =
    diff >  15 ? 'improving' :
    diff < -15 ? 'deteriorating' :
    'stable';

  const currentTheme  = detectTheme(news7d.map((n) => n.headline));
  const olderNews     = news30d.filter((n) => n.datetime * 1000 < sevenAgo.getTime());
  const previousTheme = detectTheme(olderNews.map((n) => n.headline));

  const shiftDetected = direction !== 'stable';
  const shiftDesc = shiftDetected
    ? `${ticker}'s narrative has ${direction === 'improving' ? 'improved' : 'deteriorated'}, ` +
      `shifting from "${previousTheme}" to "${currentTheme}" over the past week`
    : `${ticker}'s narrative remains stable around "${currentTheme}"`;

  const result: NarrativeShift = {
    ticker,
    narrative_direction: direction,
    current_narrative:   currentTheme,
    previous_narrative:  previousTheme,
    shift_detected:      shiftDetected,
    shift_description:   shiftDesc,
  };

  narrativeCache.set(ticker, { data: result, exp: Date.now() + NARRATIVE_TTL });
  return result;
}

// ── Build prompt section for AI routes ───────────────────────────────────────

export function buildSentimentPromptSection(
  scores: Record<string, SentimentScore>,
  narratives: Record<string, NarrativeShift> = {},
): string {
  const entries = Object.values(scores);
  if (!entries.length) return '';

  const lines = entries.map((s) => {
    const signals = s.key_signals.length ? s.key_signals.join('; ') : 'no key signals';
    const flags   = s.risk_flags.length  ? ` ⚠ RISK FLAGS: ${s.risk_flags.join('; ')}` : '';
    const shift   = narratives[s.ticker]?.shift_detected
      ? ` NARRATIVE: ${narratives[s.ticker].shift_description}`
      : '';
    return `  ${s.ticker.padEnd(7)} score=${s.overall_score > 0 ? '+' : ''}${s.overall_score} (${s.sentiment_label}, conf=${s.confidence}%): ${signals}${flags}${shift}`;
  });

  return `
REAL-TIME SENTIMENT SCORES (Finnhub + price momentum)
======================================================
${lines.join('\n')}

Sentiment guidance:
• Score > +60 (Very Bullish): strong buy/hold confirmation
• Score +20 to +60 (Bullish): favor holding/adding
• Score -20 to +20 (Neutral): hold, monitor for catalyst
• Score < -20 (Bearish): consider reducing
• Score < -60 (Very Bearish): strong sell signal
• Any ⚠ RISK FLAGS: must be explicitly addressed in reasoning
• Insider buying detected: strong independent confirmation signal
• NARRATIVE shift improving: bullish momentum building
• NARRATIVE shift deteriorating: exercise caution`;
}
