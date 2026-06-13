'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import type { IntelligenceResponse, HoldingAnalysis, RebalancingSuggestion, CorrelationMatrix } from '@/app/api/portfolio/intelligence/route';
import type { SentimentScore } from '@/lib/sentiment/engine';

// ── Weekly Letter types ───────────────────────────────────────────────────────

interface LetterResponse {
  letter: string | null;
  generated_at?: string;
  cached?: boolean;
  error?: string;
}

// ── Weekly Letter Section ─────────────────────────────────────────────────────

function WeeklyLetterSection() {
  const [letter, setLetter]               = useState<string | null>(null);
  const [generatedAt, setGeneratedAt]     = useState<string | null>(null);
  const [letterLoading, setLetterLoading] = useState(true);
  const [letterError, setLetterError]     = useState<string | null>(null);
  const [generating, setGenerating]       = useState(false);

  const fetchLetter = useCallback(async () => {
    setLetterLoading(true);
    setLetterError(null);
    try {
      const res = await fetch('/api/ai/letter');
      const data: LetterResponse = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch letter');
      setLetter(data.letter ?? null);
      setGeneratedAt(data.generated_at ?? null);
    } catch (err) {
      setLetterError(err instanceof Error ? err.message : 'Unable to load letter.');
    } finally {
      setLetterLoading(false);
    }
  }, []);

  useEffect(() => { fetchLetter(); }, [fetchLetter]);

  const generateLetter = async () => {
    setGenerating(true);
    setLetterError(null);
    try {
      const res = await fetch('/api/ai/letter', { method: 'POST' });
      const data: LetterResponse = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate letter');
      setLetter(data.letter ?? null);
      setGeneratedAt(data.generated_at ?? null);
    } catch (err) {
      setLetterError(err instanceof Error ? err.message : 'Unable to generate letter.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0]">
      {/* card header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
        <span className="text-[10px] tracking-[0.3em] uppercase text-[#B8960C] font-medium">
          Weekly Portfolio Letter
        </span>
        {generatedAt && (
          <span className="text-[11px] text-[#4A5568]">
            Generated{' '}
            {new Date(generatedAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </span>
        )}
      </div>

      <div className="px-6 py-6">
        {letterLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-3 animate-pulse bg-[#E2E8F0] rounded" style={{ width: `${85 - i * 8}%` }} />
            ))}
          </div>
        ) : letterError ? (
          <div className="flex items-center justify-between border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-[#991b1b]">{letterError}</p>
            <button
              onClick={fetchLetter}
              className="text-[11px] tracking-[0.1em] uppercase text-[#991b1b] border border-[#991b1b]/30 px-3 py-1 hover:bg-[#991b1b]/5 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : letter ? (
          <>
            <div className="max-w-prose">
              <div className="font-serif text-[15px] leading-[1.9] text-[#0A1628] whitespace-pre-wrap bg-[#FAFAF8] border border-[#E2E8F0] px-6 py-6">
                {letter}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={generateLetter}
                disabled={generating}
                className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568] border border-[#E2E8F0] px-4 py-2 hover:border-[#B8960C] hover:text-[#B8960C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating...' : 'Regenerate'}
              </button>
              <span className="text-[11px] text-[#4A5568]/60">
                Regenerating uses an API call and replaces the current letter.
              </span>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="font-serif text-lg font-light text-[#0A1628] mb-2">
              No letter generated yet
            </p>
            <p className="text-sm text-[#4A5568] mb-6 max-w-sm mx-auto">
              Generate your first weekly portfolio letter. It will be cached for 7 days.
            </p>
            <button
              onClick={generateLetter}
              disabled={generating}
              className="border border-[#B8960C] px-8 py-3 text-[11px] tracking-[0.15em] uppercase text-[#B8960C] hover:bg-[#B8960C]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating...' : 'Generate Letter'}
            </button>
            {generating && (
              <p className="text-[12px] text-[#4A5568] mt-3">
                Writing your letter. This takes about 10 seconds.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Attribution types ─────────────────────────────────────────────────────────

interface DecisionWithOutcome {
  id: string;
  symbol: string;
  action: string;
  confidence: number;
  reasoning_summary: string | null;
  price_at_decision: number | null;
  estimated_value: number | null;
  executed: boolean;
  created_at: string;
  session_type: string;
  current_price: number | null;
  return_pct: number | null;
  outcome: 'win' | 'loss' | 'neutral' | 'pending';
  days_since: number;
}

interface AttributionSummary {
  total_decisions: number;
  executed_decisions: number;
  win_rate: number;
  avg_confidence: number;
  best_call: DecisionWithOutcome | null;
  worst_call: DecisionWithOutcome | null;
  decisions: DecisionWithOutcome[];
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtNum(n: number, decimals = 2): string {
  return n ? n.toFixed(decimals) : '–';
}

function fmtPrice(n: number): string {
  if (!n) return '–';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function betaColor(beta: number): string {
  if (beta > 1.5) return 'text-[#C41E3A]';
  if (beta > 1.0) return 'text-[#B8960C]';
  return 'text-[#16A34A]';
}

function vsHighColor(pct: number): string {
  if (pct <= 5)  return 'text-[#16A34A]';
  if (pct <= 15) return 'text-[#B8960C]';
  return 'text-[#C41E3A]';
}

function sentimentColor(label: HoldingAnalysis['sentiment_label']): string {
  if (label === 'Very Bullish') return 'text-[#16A34A]';
  if (label === 'Bullish')      return 'text-[#16A34A]/70';
  if (label === 'Neutral')      return 'text-[#4A5568]';
  if (label === 'Bearish')      return 'text-[#C41E3A]/70';
  return 'text-[#C41E3A]';
}

function concRiskColor(r: IntelligenceResponse['concentration_risk']): string {
  if (r === 'high')   return 'text-[#C41E3A]';
  if (r === 'medium') return 'text-[#B8960C]';
  return 'text-[#16A34A]';
}

const ACTION_STYLE: Record<string, string> = {
  reduce:   'bg-[#C41E3A]/8 text-[#C41E3A] border border-[#C41E3A]/30',
  increase: 'bg-[#16A34A]/8 text-[#16A34A] border border-[#16A34A]/30',
  hold:     'bg-[#B8960C]/8 text-[#B8960C] border border-[#B8960C]/30',
};

// ── Loading overlay ───────────────────────────────────────────────────────────

function AnalyzingOverlay() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[#F8F9FA]">
      <div className="text-center max-w-xs">
        <div className="mx-auto mb-6 h-1 w-32 bg-[#E2E8F0] overflow-hidden">
          <div className="h-full bg-[#B8960C] animate-[pulse_1.5s_ease-in-out_infinite] w-1/2" />
        </div>
        <p className="text-[11px] tracking-[0.22em] uppercase text-[#4A5568]">Analyzing Portfolio</p>
        <p className="mt-2 text-[13px] text-[#4A5568]">Fetching market data and generating AI insights…</p>
        <p className="mt-1 text-[11px] text-[#4A5568]/60">This may take up to 15 seconds</p>
      </div>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  valueClassName,
  sub,
}: {
  label:           string;
  value:           string;
  valueClassName?: string;
  sub?:            string;
}) {
  return (
    <div className="bg-white border-r border-[#E2E8F0] last:border-r-0 px-4 sm:px-6 py-4 sm:py-5">
      <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">{label}</p>
      <p className={cn('mt-2 sm:mt-3 font-serif text-[22px] sm:text-[28px] font-light leading-none', valueClassName ?? 'text-[#0A1628]')}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-[#4A5568]">{sub}</p>}
    </div>
  );
}

// ── Sentiment card ────────────────────────────────────────────────────────────

function SentimentCircle({ score }: { score: number }) {
  const normalized = Math.max(0, Math.min(100, (score + 100) / 2));
  const radius        = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset    = circumference - (normalized / 100) * circumference;
  const color =
    score >= 60  ? '#166534' :
    score >= 20  ? '#16A34A' :
    score >= -20 ? '#B8960C' :
    score >= -60 ? '#C41E3A' : '#991b1b';

  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="4" />
      <circle
        cx="28" cy="28" r={radius}
        fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 28 28)"
        strokeLinecap="round"
      />
      <text x="28" y="33" textAnchor="middle" fontSize="11" fill={color} fontFamily="serif" fontWeight="300">
        {score > 0 ? '+' : ''}{score}
      </text>
    </svg>
  );
}

function SentimentCard({ s }: { s: SentimentScore }) {
  const labelColor =
    s.overall_score >= 60  ? 'text-[#166534]' :
    s.overall_score >= 20  ? 'text-[#16A34A]' :
    s.overall_score >= -20 ? 'text-[#B8960C]' :
    s.overall_score >= -60 ? 'text-[#C41E3A]' : 'text-[#991b1b]';

  return (
    <div className="bg-white border border-[#E2E8F0] p-4">
      <div className="flex items-center gap-3 mb-3">
        <SentimentCircle score={s.overall_score} />
        <div className="min-w-0">
          <p className="font-mono font-bold text-[#0A1628] text-sm tracking-wide">{s.ticker}</p>
          <p className={cn('text-[11px] font-medium', labelColor)}>{s.sentiment_label}</p>
          <p className="text-[9px] text-[#4A5568]/60 mt-0.5">{s.confidence}% confidence</p>
        </div>
      </div>

      {/* Key signals */}
      {s.key_signals.length > 0 && (
        <div className="space-y-1 mb-2">
          {s.key_signals.slice(0, 3).map((sig, i) => (
            <p key={i} className="text-[10px] text-[#4A5568] leading-snug flex gap-1">
              <span className="text-[#166534] shrink-0">▲</span>
              <span className="truncate">{sig}</span>
            </p>
          ))}
        </div>
      )}

      {/* Risk flags */}
      {s.risk_flags.length > 0 && (
        <div className="border-t border-[#E2E8F0] pt-2 mt-2 space-y-1">
          {s.risk_flags.map((flag, i) => (
            <p key={i} className="text-[10px] text-[#991b1b] leading-snug flex gap-1">
              <span className="shrink-0">⚠</span>
              <span className="line-clamp-2">{flag}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Correlation Risk Section ──────────────────────────────────────────────────

function CorrelationRiskSection({ matrix }: { matrix: CorrelationMatrix | null }) {
  const hasPairs = (matrix?.high_correlation_pairs?.length ?? 0) > 0;

  return (
    <section className="bg-white">
      <div className="px-4 sm:px-5 py-3 border-b border-[#E2E8F0]">
        <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Concentration Risk</p>
        <p className="text-[9px] text-[#4A5568]/60 mt-0.5">Highly Correlated Holdings — 90-day return correlation</p>
      </div>

      {!hasPairs ? (
        <div className="px-4 sm:px-5 py-6 text-center">
          <p className="text-[13px] text-[#16A34A]">
            Portfolio is well-diversified — no highly correlated pairs detected.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#E2E8F0]">
          {matrix!.high_correlation_pairs.slice(0, 5).map((pair) => {
            const pct = Math.abs(pair.correlation * 100);
            return (
              <div key={`${pair.symbolA}-${pair.symbolB}`} className="px-4 sm:px-5 py-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[13px] font-semibold tracking-[0.05em] text-[#0A1628]">
                    {pair.symbolA}
                  </span>
                  <span className="text-[11px] text-[#4A5568]/60">/</span>
                  <span className="text-[13px] font-semibold tracking-[0.05em] text-[#0A1628]">
                    {pair.symbolB}
                  </span>
                  <span className="ml-auto font-serif text-[14px] text-[#C41E3A]">
                    {pct.toFixed(0)}% correlated
                  </span>
                  <span className="shrink-0 px-2 py-0.5 text-[9px] tracking-[0.12em] uppercase font-semibold bg-[#C41E3A]/10 text-[#C41E3A] border border-[#C41E3A]/30">
                    HIGH RISK
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#F0F2F5]">
                  <div
                    className="h-full bg-[#C41E3A]"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="px-4 sm:px-5 py-3 text-right">
            <p className="text-[9px] text-[#4A5568]/50 tracking-[0.1em]">
              Pairs with |correlation| ≥ 85% over 90 trading days. Consider reducing one position in each pair to improve diversification.
            </p>
          </div>
        </div>
      )}
      {(matrix?.insufficient_history?.length ?? 0) > 0 && (
        <div className="px-4 sm:px-5 py-3 border-t border-[#E2E8F0]">
          <p className="text-[10px] text-[#B8960C]">
            Insufficient history for correlation: {matrix!.insufficient_history.join(', ')} — fewer than 30 trading days of price data.
          </p>
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<'analysis' | 'letters'>('analysis');

  const [data,           setData]           = useState<IntelligenceResponse | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [error,          setError]          = useState(false);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  // Sentiment Intelligence
  const [sentimentScores,  setSentimentScores]  = useState<SentimentScore[]>([]);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentLoaded,  setSentimentLoaded]  = useState(false);

  // Attribution / Decision Track Record
  const [attribution,        setAttribution]        = useState<AttributionSummary | null>(null);
  const [attributionLoading, setAttributionLoading] = useState(true);

  const fetchIntelligence = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError(false);

    try {
      await fetch('/api/alpaca/sync').catch(() => {
        console.warn('[intelligence] sync failed — continuing with cached holdings');
      });

      const res = await fetch('/api/portfolio/intelligence', { method: 'POST' });
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchAttribution = useCallback(async () => {
    setAttributionLoading(true);
    try {
      const res = await fetch('/api/ai/attribution');
      if (res.ok) setAttribution(await res.json());
    } catch { /* non-fatal */ } finally {
      setAttributionLoading(false);
    }
  }, []);

  const fetchSentimentScores = useCallback(async (tickers: string[]) => {
    if (!tickers.length) return;
    setSentimentLoading(true);
    try {
      const res = await fetch(`/api/market/sentiment?tickers=${tickers.join(',')}`);
      if (res.ok) {
        const scores: SentimentScore[] = await res.json();
        setSentimentScores(scores.sort((a, b) => b.overall_score - a.overall_score));
        setSentimentLoaded(true);
      }
    } catch { /* non-fatal */ } finally {
      setSentimentLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntelligence();
    fetchAttribution();
  }, [fetchIntelligence, fetchAttribution]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const avgSentimentLabel = (() => {
    if (!data?.holdings_analysis.length) return 'Neutral';
    const avg = data.holdings_analysis.reduce((s, h) => s + h.sentiment_score, 0) / data.holdings_analysis.length;
    if (avg >= 70) return 'Very Bullish';
    if (avg >= 57) return 'Bullish';
    if (avg >= 43) return 'Neutral';
    if (avg >= 30) return 'Bearish';
    return 'Very Bearish';
  })();

  // ── Render states ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Portfolio Intelligence" />
        <AnalyzingOverlay />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Portfolio Intelligence" />
        <div className="flex flex-1 flex-col items-center justify-center bg-[#F8F9FA] gap-4">
          <p className="text-[13px] text-[#4A5568]">Analysis failed. Please try again.</p>
          <button
            onClick={() => fetchIntelligence()}
            className="border border-[#0A1628] px-5 py-2.5 text-[12px] tracking-[0.1em] uppercase text-[#0A1628] hover:bg-[#0A1628] hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Portfolio Intelligence" />
        <div className="flex flex-1 flex-col items-center justify-center bg-[#F8F9FA] px-4">
          <div className="bg-white border border-[#E2E8F0] px-6 sm:px-8 py-16 text-center max-w-md w-full">
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#B8960C] mb-4">No Data</p>
            <h3 className="font-serif text-[24px] sm:text-[28px] font-light text-[#0A1628] mb-3 leading-tight">
              No intelligence data available.
            </h3>
            <p className="text-[14px] text-[#4A5568] max-w-sm mx-auto mb-8 leading-relaxed">
              Add holdings to your portfolio and run a fresh analysis to unlock AI-powered portfolio intelligence.
            </p>
            <a
              href="/holdings"
              className="inline-block bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:bg-[#162035] transition-colors"
            >
              View Holdings
            </a>
          </div>
        </div>
      </div>
    );
  }

  const hasHoldings = data.holdings_analysis.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Portfolio Intelligence" />

      <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">

        {/* ── Tab switcher ─────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6">
          <div className="flex items-center gap-6">
            {(['analysis', 'letters'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'py-3 text-[11px] tracking-[0.15em] uppercase transition-colors',
                  activeTab === tab
                    ? 'border-b-2 border-[#B8960C] text-[#0A1628] -mb-px'
                    : 'text-[#4A5568] hover:text-[#0A1628]',
                )}
              >
                {tab === 'analysis' ? 'Analysis' : 'Letters'}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'letters' ? (
          <div className="mx-auto max-w-7xl p-4 sm:p-8">
            <WeeklyLetterSection />
          </div>
        ) : (
        <div className="mx-auto max-w-7xl divide-y divide-[#E2E8F0]">

          {/* ── S1: Portfolio Health Score ──────────────────────────────────── */}
          <section className="bg-[#0A1628] px-4 sm:px-6 py-8 sm:py-10">
            <div className="text-center mx-auto max-w-full">
              <p
                className="font-serif font-light leading-none text-[#B8960C]"
                style={{ fontSize: 'clamp(36px, 10vw, 72px)' }}
              >
                {data.health_score}
              </p>
              <p className="mt-3 text-[12px] tracking-[0.22em] uppercase text-white/60">
                Portfolio Health Score
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-8 gap-y-3">
                <div>
                  <span className="text-[10px] tracking-[0.15em] uppercase text-white/40">Risk Level</span>
                  <span className="mx-2 text-white/20">·</span>
                  <span className="text-[13px] font-medium text-white/90">
                    {data.risk_score < 35 ? 'LOW' : data.risk_score < 65 ? 'MODERATE' : 'HIGH'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] tracking-[0.15em] uppercase text-white/40">Diversification</span>
                  <span className="mx-2 text-white/20">·</span>
                  <span className="text-[13px] font-medium text-white/90">
                    {data.diversification_score < 35 ? 'LOW' : data.diversification_score < 65 ? 'MODERATE' : 'HIGH'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] tracking-[0.15em] uppercase text-white/40">Concentration</span>
                  <span className="mx-2 text-white/20">·</span>
                  <span className={cn(
                    'text-[13px] font-medium',
                    data.concentration_risk === 'high'
                      ? 'text-[#C41E3A]'
                      : data.concentration_risk === 'medium'
                        ? 'text-[#B8960C]'
                        : 'text-[#16A34A]',
                  )}>
                    {data.concentration_risk.toUpperCase()}
                  </span>
                </div>
              </div>

              {data.portfolio_summary && (
                <>
                  <hr className="mt-6 border-white/10" />
                  <p className="mt-5 mx-auto max-w-2xl font-serif text-[14px] italic font-light leading-relaxed text-white/70">
                    {data.portfolio_summary}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* ── S2: Risk Metrics ────────────────────────────────────────────── */}
          <section>
            <div className="grid grid-cols-2 gap-px sm:grid-cols-4 bg-[#E2E8F0]">
              <MetricCard
                label="Portfolio Beta"
                value={fmtNum(data.risk_score / 50)}
                sub={data.risk_score < 50 ? 'Lower market volatility' : 'Higher market volatility'}
              />
              <MetricCard
                label="Concentration Risk"
                value={data.concentration_risk.toUpperCase()}
                valueClassName={concRiskColor(data.concentration_risk)}
                sub={data.holdings_analysis.length > 0
                  ? `${Math.max(...data.holdings_analysis.map((h) => h.weight_pct)).toFixed(1)}% largest position`
                  : undefined}
              />
              <MetricCard
                label="Sector Diversity"
                value={String(data.sector_exposure.length)}
                sub={`sector${data.sector_exposure.length !== 1 ? 's' : ''} represented`}
              />
              <MetricCard
                label="Market Sentiment"
                value={avgSentimentLabel}
                valueClassName={cn(
                  'text-[18px] sm:text-[22px]',
                  avgSentimentLabel.includes('Bullish')
                    ? 'text-[#16A34A]'
                    : avgSentimentLabel === 'Neutral'
                      ? 'text-[#4A5568]'
                      : 'text-[#C41E3A]',
                )}
                sub="Finnhub aggregate"
              />
            </div>
          </section>

          {/* ── S3: Holdings Deep Dive ──────────────────────────────────────── */}
          <section className="bg-white">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#E2E8F0]">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Holdings Deep Dive</p>
              <p className="text-[10px] text-[#4A5568]/60">Click AI Thesis to expand</p>
            </div>

            {!hasHoldings ? (
              <div className="px-4 sm:px-8 py-16 text-center">
                <p className="text-[10px] tracking-[0.25em] uppercase text-[#B8960C] mb-4">Empty Portfolio</p>
                <h3 className="font-serif text-[24px] sm:text-[28px] font-light text-[#0A1628] mb-3 leading-tight">
                  No holdings to analyze.
                </h3>
                <p className="text-[14px] text-[#4A5568] max-w-sm mx-auto mb-8 leading-relaxed">
                  Make your first trade to unlock deep AI portfolio intelligence and per-stock insights.
                </p>
                <a
                  href="/dashboard"
                  className="inline-block bg-[#B8960C] text-white text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:bg-[#9a7d0a] transition-colors"
                >
                  Go to Dashboard
                </a>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{ minWidth: 600 }}>
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      {['Ticker', 'Weight', 'Beta', 'P/E', '52W High', 'vs High', 'Sentiment', 'AI Thesis'].map((h) => (
                        <th key={h} className="px-3 sm:px-4 py-3 text-[10px] tracking-[0.12em] uppercase text-[#4A5568] font-normal whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.holdings_analysis.map((h) => (
                      <tr
                        key={h.ticker}
                        className="border-b border-[#E2E8F0] hover:bg-[#F8F9FA] transition-colors"
                      >
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                          <span className="text-[13px] font-semibold tracking-[0.05em] text-[#0A1628]">{h.ticker}</span>
                        </td>

                        <td className="px-3 sm:px-4 py-3 min-w-[80px] sm:min-w-[100px]">
                          <div className="space-y-1">
                            <span className="text-[12px] font-medium text-[#0A1628]">{h.weight_pct.toFixed(1)}%</span>
                            <div className="h-1 w-full bg-[#F0F2F5]">
                              <div
                                className="h-full bg-[#B8960C]"
                                style={{ width: `${Math.min(h.weight_pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                          <span className={cn('font-serif text-[14px]', betaColor(h.beta))}>
                            {fmtNum(h.beta)}
                          </span>
                        </td>

                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                          <span className="font-serif text-[14px] text-[#0A1628]">
                            {h.pe_ratio > 0 ? fmtNum(h.pe_ratio, 1) : '–'}
                          </span>
                        </td>

                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                          <span className="font-serif text-[14px] text-[#0A1628]">
                            {h.week52_high > 0 ? `$${fmtPrice(h.week52_high)}` : '–'}
                          </span>
                        </td>

                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                          {h.week52_high === 0 ? (
                            <span className="font-serif text-[14px] text-[#4A5568]">—</span>
                          ) : (
                            <span className={cn('font-serif text-[14px]', vsHighColor(h.current_vs_52w_high))}>
                              {h.current_vs_52w_high > 0 ? `-${fmtNum(h.current_vs_52w_high, 1)}%` : 'AT HIGH'}
                            </span>
                          )}
                        </td>

                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                          <span className={cn('text-[12px] font-medium', sentimentColor(h.sentiment_label))}>
                            {h.sentiment_label}
                          </span>
                        </td>

                        <td className="px-3 sm:px-4 py-3 max-w-[200px] sm:max-w-[240px]">
                          <button
                            onClick={() => setExpandedTicker(expandedTicker === h.ticker ? null : h.ticker)}
                            className="text-left w-full"
                          >
                            <div className="flex items-start gap-1">
                              <p className={cn(
                                'text-[11px] italic text-[#4A5568] transition-all duration-200 flex-1',
                                expandedTicker === h.ticker ? 'whitespace-normal' : 'truncate',
                              )}>
                                {h.ai_thesis}
                              </p>
                              <span className="shrink-0 mt-0.5 text-[#4A5568]/60">
                                {expandedTicker === h.ticker
                                  ? <ChevronUp className="h-3 w-3" />
                                  : <ChevronDown className="h-3 w-3" />
                                }
                              </span>
                            </div>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── S4: Rebalancing + Sector Exposure ──────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F0]">

            <div className="lg:col-span-3 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 border-b border-[#E2E8F0]">
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">AI Rebalancing Recommendations</p>
                <div className="flex items-center gap-3">
                  {data.generated_at && (
                    <span className="text-[10px] text-[#4A5568]/60">
                      Updated {fmtTime(data.generated_at)}
                    </span>
                  )}
                  <button
                    onClick={() => fetchIntelligence(true)}
                    disabled={refreshing}
                    className="border border-[#0A1628] px-3 py-1 text-[10px] tracking-[0.1em] uppercase text-[#0A1628] hover:bg-[#0A1628] hover:text-white transition-colors disabled:opacity-40"
                  >
                    {refreshing ? 'Running…' : 'Run Fresh Analysis'}
                  </button>
                </div>
              </div>

              {data.rebalancing_suggestions.length === 0 ? (
                <div className="px-4 sm:px-5 py-8 text-center">
                  <p className="text-[13px] text-[#4A5568]">No rebalancing recommendations at this time.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {data.rebalancing_suggestions.map((r: RebalancingSuggestion) => (
                    <div key={r.ticker} className="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-4">
                      <span className={cn(
                        'shrink-0 mt-0.5 px-2 py-0.5 text-[9px] tracking-[0.12em] uppercase font-semibold',
                        ACTION_STYLE[r.action] ?? ACTION_STYLE.hold,
                      )}>
                        {r.action.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <span className="text-[13px] font-semibold text-[#0A1628] mr-2">{r.ticker}</span>
                        <span className="text-xs sm:text-[13px] text-[#4A5568]">{r.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 bg-white flex flex-col">
              <div className="px-4 sm:px-5 py-3 border-b border-[#E2E8F0]">
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Sector Exposure</p>
              </div>

              {data.correlation_warning && (
                <div className="mx-4 sm:mx-5 mt-4 border border-[#C41E3A]/30 bg-[#C41E3A]/5 px-4 py-3">
                  <p className="text-[11px] text-[#C41E3A] leading-snug">
                    Portfolio heavily concentrated in {data.sector_exposure[0]?.sector ?? 'one sector'}.
                    Consider diversifying across additional sectors.
                  </p>
                </div>
              )}

              {data.sector_exposure.length === 0 ? (
                <div className="px-4 sm:px-5 py-8 text-center">
                  <p className="text-[13px] text-[#4A5568]">No sector data available.</p>
                </div>
              ) : (
                <div className="flex-1 px-4 sm:px-5 py-4 space-y-3">
                  {data.sector_exposure.map((s) => (
                    <div key={s.sector}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] text-[#0A1628] truncate pr-2">{s.sector}</span>
                        <span className="font-serif text-[13px] font-light text-[#0A1628] shrink-0">
                          {s.pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#F0F2F5]">
                        <div
                          className="h-full bg-[#B8960C]"
                          style={{ width: `${Math.min(s.pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── S4b: Correlation Risk ───────────────────────────────────────── */}
          <CorrelationRiskSection matrix={data.correlationMatrix ?? null} />

          {/* ── S5: Portfolio Summary ───────────────────────────────────────── */}
          {data.portfolio_summary && (
            <section className="bg-white px-4 sm:px-6 py-8">
              <p className="text-[9px] tracking-[0.22em] uppercase text-[#B8960C] mb-4">AI Assessment</p>
              <div className="border-l-2 border-[#B8960C] pl-5">
                <p className="font-serif text-[16px] font-light leading-relaxed text-[#0A1628]">
                  {data.portfolio_summary}
                </p>
              </div>
            </section>
          )}

          {/* ── S6: Sentiment Intelligence ──────────────────────────────────── */}
          {hasHoldings && (
            <section className="bg-[#F8F9FA]">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-[#E2E8F0]">
                <div>
                  <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Sentiment Intelligence</p>
                  <p className="text-[9px] text-[#4A5568]/60 mt-0.5">Powered by Finnhub + price momentum analysis</p>
                </div>
                <button
                  onClick={() => fetchSentimentScores(data.holdings_analysis.map((h) => h.ticker))}
                  disabled={sentimentLoading}
                  className="text-[11px] tracking-[0.12em] uppercase px-4 py-1.5 border border-[#B8960C] text-[#B8960C] hover:bg-[#B8960C] hover:text-white transition-colors disabled:opacity-40"
                >
                  {sentimentLoading ? 'Loading...' : sentimentLoaded ? 'Refresh Scores' : 'Load Sentiment Scores'}
                </button>
              </div>

              {sentimentLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-[#E2E8F0] border-t border-[#E2E8F0]">
                  {data.holdings_analysis.slice(0, 8).map((_, i) => (
                    <div key={i} className="bg-white p-4 space-y-2">
                      <div className="h-14 w-14 rounded-full animate-pulse bg-[#E2E8F0]" />
                      <div className="h-3 w-16 animate-pulse bg-[#E2E8F0]" />
                      <div className="h-2.5 w-12 animate-pulse bg-[#E2E8F0]" />
                    </div>
                  ))}
                </div>
              )}

              {!sentimentLoading && sentimentLoaded && sentimentScores.length > 0 && (
                <>
                  {/* Risk flags alert bar */}
                  {sentimentScores.some((s) => s.risk_flags.length > 0) && (
                    <div className="border-t border-[#E2E8F0] bg-[#991b1b]/5 px-4 sm:px-6 py-3">
                      <p className="text-[10px] tracking-[0.18em] uppercase text-[#991b1b] mb-1">Active Risk Flags</p>
                      <div className="flex flex-wrap gap-3">
                        {sentimentScores
                          .filter((s) => s.risk_flags.length > 0)
                          .map((s) => (
                            <span key={s.ticker} className="text-[11px] text-[#991b1b]">
                              <strong>{s.ticker}</strong>: {s.risk_flags[0]}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-[#E2E8F0] border-t border-[#E2E8F0]">
                    {sentimentScores.map((s) => (
                      <SentimentCard key={s.ticker} s={s} />
                    ))}
                  </div>

                  <div className="px-4 sm:px-6 py-3 border-t border-[#E2E8F0] text-right">
                    <p className="text-[9px] text-[#4A5568]/50 tracking-[0.1em]">
                      Scores combine: news sentiment · social mentions · insider transactions · analyst ratings · price momentum
                    </p>
                  </div>
                </>
              )}

              {!sentimentLoading && !sentimentLoaded && (
                <div className="border-t border-[#E2E8F0] bg-white px-6 py-10 text-center">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-[#B8960C] mb-2">5-Signal Composite</p>
                  <p className="font-serif text-[18px] font-light text-[#0A1628] mb-1">Real-Time Sentiment Scoring</p>
                  <p className="text-sm text-[#4A5568] mb-0">
                    Click &quot;Load Sentiment Scores&quot; to analyze news, social media, insider activity, analyst ratings, and price momentum for each holding.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ── S7: Decision Track Record ───────────────────────────────────── */}
          <section className="bg-white">
            <div className="px-4 sm:px-5 py-3 border-b border-[#E2E8F0]">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">AI Decision Track Record</p>
              <p className="text-[9px] text-[#4A5568]/60 mt-0.5">Performance attribution for AutoPilot decisions — last 90 days</p>
            </div>

            {attributionLoading ? (
              <div className="px-4 sm:px-6 py-10">
                <div className="grid grid-cols-3 gap-px bg-[#E2E8F0] border border-[#E2E8F0] mb-6">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="bg-white px-4 sm:px-6 py-4 sm:py-5 space-y-2">
                      <div className="h-2.5 w-16 animate-pulse bg-[#E2E8F0]" />
                      <div className="h-7 w-12 animate-pulse bg-[#E2E8F0]" />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-10 w-full animate-pulse bg-[#F0F2F5]" />
                  ))}
                </div>
              </div>
            ) : !attribution || attribution.total_decisions === 0 ? (
              <div className="px-4 sm:px-8 py-16 text-center">
                <p className="text-[10px] tracking-[0.25em] uppercase text-[#B8960C] mb-4">No Data Yet</p>
                <h3 className="font-serif text-[22px] sm:text-[26px] font-light text-[#0A1628] mb-3 leading-tight">
                  No AI decisions logged yet.
                </h3>
                <p className="text-[14px] text-[#4A5568] max-w-sm mx-auto leading-relaxed">
                  Run AutoPilot or an Analysis to start tracking your AI&apos;s performance.
                </p>
              </div>
            ) : (
              <>
                {/* Summary metric cards */}
                <div className="grid grid-cols-3 gap-px bg-[#E2E8F0] border-b border-[#E2E8F0]">
                  <div className="bg-white px-4 sm:px-6 py-4 sm:py-5">
                    <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Win Rate</p>
                    <p className={cn(
                      'mt-2 sm:mt-3 font-serif text-[22px] sm:text-[28px] font-light leading-none',
                      attribution.win_rate >= 60 ? 'text-[#16A34A]' :
                      attribution.win_rate >= 40 ? 'text-[#B8960C]' : 'text-[#C41E3A]',
                    )}>
                      {attribution.win_rate}%
                    </p>
                    <p className="mt-1.5 text-[11px] text-[#4A5568]">
                      {attribution.decisions.filter(d => d.outcome === 'win').length} of{' '}
                      {attribution.decisions.filter(d => d.outcome !== 'pending').length} scoreable
                    </p>
                  </div>
                  <div className="bg-white px-4 sm:px-6 py-4 sm:py-5">
                    <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Total Decisions</p>
                    <p className="mt-2 sm:mt-3 font-serif text-[22px] sm:text-[28px] font-light leading-none text-[#0A1628]">
                      {attribution.total_decisions}
                    </p>
                    <p className="mt-1.5 text-[11px] text-[#4A5568]">
                      {attribution.executed_decisions} executed
                    </p>
                  </div>
                  <div className="bg-white px-4 sm:px-6 py-4 sm:py-5">
                    <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Avg Confidence</p>
                    <p className={cn(
                      'mt-2 sm:mt-3 font-serif text-[22px] sm:text-[28px] font-light leading-none',
                      attribution.avg_confidence >= 75 ? 'text-[#16A34A]' :
                      attribution.avg_confidence >= 60 ? 'text-[#B8960C]' : 'text-[#4A5568]',
                    )}>
                      {attribution.avg_confidence}%
                    </p>
                    <p className="mt-1.5 text-[11px] text-[#4A5568]">AI self-confidence</p>
                  </div>
                </div>

                {/* Best / Worst call highlight */}
                {(attribution.best_call || attribution.worst_call) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#E2E8F0] border-b border-[#E2E8F0]">
                    {attribution.best_call && (
                      <div className="bg-[#16A34A]/5 px-4 sm:px-5 py-3 flex items-center gap-3">
                        <span className="shrink-0 px-2 py-0.5 text-[9px] tracking-[0.12em] uppercase font-semibold bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30">
                          Best Call
                        </span>
                        <span className="font-mono font-bold text-[#0A1628] text-sm">{attribution.best_call.symbol}</span>
                        <span className="text-[12px] text-[#4A5568] uppercase">{attribution.best_call.action}</span>
                        {attribution.best_call.return_pct !== null && (
                          <span className="ml-auto font-serif text-[14px] text-[#16A34A]">
                            {attribution.best_call.return_pct > 0 ? '+' : ''}{attribution.best_call.return_pct}%
                          </span>
                        )}
                      </div>
                    )}
                    {attribution.worst_call && (
                      <div className="bg-[#C41E3A]/5 px-4 sm:px-5 py-3 flex items-center gap-3">
                        <span className="shrink-0 px-2 py-0.5 text-[9px] tracking-[0.12em] uppercase font-semibold bg-[#C41E3A]/10 text-[#C41E3A] border border-[#C41E3A]/30">
                          Worst Call
                        </span>
                        <span className="font-mono font-bold text-[#0A1628] text-sm">{attribution.worst_call.symbol}</span>
                        <span className="text-[12px] text-[#4A5568] uppercase">{attribution.worst_call.action}</span>
                        {attribution.worst_call.return_pct !== null && (
                          <span className="ml-auto font-serif text-[14px] text-[#C41E3A]">
                            {attribution.worst_call.return_pct > 0 ? '+' : ''}{attribution.worst_call.return_pct}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Decisions table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse" style={{ minWidth: 560 }}>
                    <thead>
                      <tr className="border-b border-[#E2E8F0]">
                        {['Symbol', 'Action', 'Confidence', 'Return', 'Outcome', 'Days Ago'].map((h) => (
                          <th key={h} className="px-3 sm:px-4 py-3 text-[10px] tracking-[0.12em] uppercase text-[#4A5568] font-normal whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attribution.decisions.slice(0, 10).map((d) => (
                        <tr key={d.id} className="border-b border-[#E2E8F0] hover:bg-[#F8F9FA] transition-colors">
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            <span className="text-[13px] font-semibold tracking-[0.05em] text-[#0A1628]">{d.symbol}</span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            <span className={cn(
                              'px-2 py-0.5 text-[9px] tracking-[0.12em] uppercase font-semibold',
                              d.action === 'buy'  ? 'bg-[#16A34A]/8 text-[#16A34A] border border-[#16A34A]/30' :
                              d.action === 'sell' ? 'bg-[#C41E3A]/8 text-[#C41E3A] border border-[#C41E3A]/30' :
                                                    'bg-[#B8960C]/8 text-[#B8960C] border border-[#B8960C]/30',
                            )}>
                              {d.action}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            <span className={cn(
                              'font-serif text-[14px]',
                              d.confidence >= 75 ? 'text-[#16A34A]' :
                              d.confidence >= 60 ? 'text-[#B8960C]' : 'text-[#4A5568]',
                            )}>
                              {d.confidence ?? '–'}%
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            {d.return_pct !== null ? (
                              <span className={cn(
                                'font-serif text-[14px]',
                                d.return_pct > 0 ? 'text-[#16A34A]' :
                                d.return_pct < 0 ? 'text-[#C41E3A]' : 'text-[#4A5568]',
                              )}>
                                {d.return_pct > 0 ? '+' : ''}{d.return_pct}%
                              </span>
                            ) : (
                              <span className="text-[12px] text-[#4A5568]/50">–</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            <span className={cn(
                              'px-2 py-0.5 text-[9px] tracking-[0.12em] uppercase font-semibold',
                              d.outcome === 'win'     ? 'bg-[#16A34A]/8 text-[#16A34A] border border-[#16A34A]/30' :
                              d.outcome === 'loss'    ? 'bg-[#C41E3A]/8 text-[#C41E3A] border border-[#C41E3A]/30' :
                              d.outcome === 'neutral' ? 'bg-[#4A5568]/8 text-[#4A5568] border border-[#4A5568]/30' :
                                                        'bg-[#B8960C]/8 text-[#B8960C] border border-[#B8960C]/30',
                            )}>
                              {d.outcome}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                            <span className="text-[12px] text-[#4A5568]">{d.days_since}d</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {attribution.total_decisions > 10 && (
                  <div className="px-4 sm:px-5 py-3 border-t border-[#E2E8F0] text-right">
                    <p className="text-[10px] text-[#4A5568]/50 tracking-[0.1em]">
                      Showing 10 of {attribution.total_decisions} decisions — last 90 days
                    </p>
                  </div>
                )}
              </>
            )}
          </section>

        </div>
        )}
      </main>
    </div>
  );
}
