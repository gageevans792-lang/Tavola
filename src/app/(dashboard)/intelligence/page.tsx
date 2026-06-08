'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import type { IntelligenceResponse, HoldingAnalysis, RebalancingSuggestion } from '@/app/api/portfolio/intelligence/route';

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtNum(n: number, decimals = 2): string {
  return n ? n.toFixed(decimals) : '—';
}

function fmtPrice(n: number): string {
  if (!n) return '—';
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
    <div className="bg-white border-r border-[#E2E8F0] last:border-r-0 px-6 py-5">
      <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">{label}</p>
      <p className={cn('mt-3 font-serif text-[28px] font-light leading-none', valueClassName ?? 'text-[#0A1628]')}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-[#4A5568]">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [data,           setData]           = useState<IntelligenceResponse | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [error,          setError]          = useState(false);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

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

  useEffect(() => { fetchIntelligence(); }, [fetchIntelligence]);

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

  if (!data) return null;

  const hasHoldings = data.holdings_analysis.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Portfolio Intelligence" />

      <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
        <div className="mx-auto max-w-7xl divide-y divide-[#E2E8F0]">

          {/* ── S1: Portfolio Health Score ──────────────────────────────────── */}
          <section className="bg-[#0A1628] px-6 py-10">
            <div className="text-center">
              <p className="font-serif font-light leading-none text-[#B8960C]" style={{ fontSize: 'clamp(48px, 15vw, 80px)' }}>
                {data.health_score}
              </p>
              <p className="mt-3 text-[12px] tracking-[0.22em] uppercase text-white/60">
                Portfolio Health Score
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
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
                  'text-[22px]',
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
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0]">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Holdings Deep Dive</p>
              <p className="text-[10px] text-[#4A5568]/60">Click AI Thesis to expand</p>
            </div>

            {!hasHoldings ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[13px] text-[#4A5568]">No holdings to analyze. Make your first trade to unlock portfolio intelligence.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      {['Ticker', 'Weight', 'Beta', 'P/E', '52W High', 'vs High', 'Sentiment', 'AI Thesis'].map((h) => (
                        <th key={h} className="px-4 py-3 text-[10px] tracking-[0.12em] uppercase text-[#4A5568] font-normal whitespace-nowrap">
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-[13px] font-semibold tracking-[0.05em] text-[#0A1628]">{h.ticker}</span>
                        </td>

                        <td className="px-4 py-3 min-w-[100px]">
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

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn('font-serif text-[14px]', betaColor(h.beta))}>
                            {fmtNum(h.beta)}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-serif text-[14px] text-[#0A1628]">
                            {h.pe_ratio > 0 ? fmtNum(h.pe_ratio, 1) : '—'}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-serif text-[14px] text-[#0A1628]">
                            {h.week52_high > 0 ? `$${fmtPrice(h.week52_high)}` : '—'}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn('font-serif text-[14px]', vsHighColor(h.current_vs_52w_high))}>
                            {h.current_vs_52w_high > 0 ? `-${fmtNum(h.current_vs_52w_high, 1)}%` : 'AT HIGH'}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn('text-[12px] font-medium', sentimentColor(h.sentiment_label))}>
                            {h.sentiment_label}
                          </span>
                        </td>

                        <td className="px-4 py-3 max-w-[240px]">
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
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0]">
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
                <div className="px-5 py-8 text-center">
                  <p className="text-[13px] text-[#4A5568]">No rebalancing recommendations at this time.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {data.rebalancing_suggestions.map((r: RebalancingSuggestion) => (
                    <div key={r.ticker} className="flex items-start gap-4 px-5 py-4">
                      <span className={cn(
                        'shrink-0 mt-0.5 px-2 py-0.5 text-[9px] tracking-[0.12em] uppercase font-semibold',
                        ACTION_STYLE[r.action] ?? ACTION_STYLE.hold,
                      )}>
                        {r.action.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <span className="text-[13px] font-semibold text-[#0A1628] mr-2">{r.ticker}</span>
                        <span className="text-[13px] text-[#4A5568]">{r.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 bg-white flex flex-col">
              <div className="px-5 py-3 border-b border-[#E2E8F0]">
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Sector Exposure</p>
              </div>

              {data.correlation_warning && (
                <div className="mx-5 mt-4 border border-[#C41E3A]/30 bg-[#C41E3A]/5 px-4 py-3">
                  <p className="text-[11px] text-[#C41E3A] leading-snug">
                    Portfolio heavily concentrated in {data.sector_exposure[0]?.sector ?? 'one sector'}.
                    Consider diversifying across additional sectors.
                  </p>
                </div>
              )}

              {data.sector_exposure.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-[13px] text-[#4A5568]">No sector data available.</p>
                </div>
              ) : (
                <div className="flex-1 px-5 py-4 space-y-3">
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

          {/* ── S5: Portfolio Summary ───────────────────────────────────────── */}
          {data.portfolio_summary && (
            <section className="bg-white px-6 py-8">
              <p className="text-[9px] tracking-[0.22em] uppercase text-[#B8960C] mb-4">AI Assessment</p>
              <div className="border-l-2 border-[#B8960C] pl-5">
                <p className="font-serif text-[16px] font-light leading-relaxed text-[#0A1628]">
                  {data.portfolio_summary}
                </p>
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}
