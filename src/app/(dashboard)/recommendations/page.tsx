'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';

type Rec = {
  id:                 string;
  ticker:             string;
  action:             'buy' | 'sell' | 'hold';
  qty:                number;
  reasoning:          string;
  confidence:         number;
  source:             string;
  user_decision:      'pending' | 'accepted' | 'rejected' | 'watching';
  decision_at:        string | null;
  outcome_pct_change: number | null;
  outcome_date:       string | null;
  created_at:         string;
};

type Filter = 'all' | 'pending' | 'accepted' | 'rejected' | 'watching';

const PAGE_SIZE = 50;

const ACTION_BADGE: Record<string, string> = {
  buy:  'bg-[#B8960C] text-[#0A1628]',
  sell: 'bg-[#C41E3A] text-white',
  hold: 'bg-[#E2E8F0] text-[#4A5568]',
};

const DECISION_COLOR: Record<string, string> = {
  pending:  'text-[#4A5568]',
  accepted: 'text-[#166534]',
  rejected: 'text-[#991b1b]',
  watching: 'text-[#B8960C]',
};

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}

function OutcomePct({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[#4A5568]">—</span>;
  const pos = value >= 0;
  return (
    <span className={pos ? 'text-[#166534]' : 'text-[#991b1b]'}>
      {pos ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

export default function RecommendationsPage() {
  const [allRecs,    setAllRecs]    = useState<Rec[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<Filter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page,       setPage]       = useState(0);

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recommendations?status=all&limit=500');
      if (!res.ok) return;
      const data = await res.json() as { recommendations: Rec[] };
      setAllRecs(data.recommendations ?? []);
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecs(); }, [fetchRecs]);
  useEffect(() => { setPage(0); setExpandedId(null); }, [filter]);

  // ── Client-side filter + pagination ──────────────────────────────────────────
  const filtered = useMemo(() => (
    filter === 'all' ? allRecs : allRecs.filter(r => r.user_decision === filter)
  ), [allRecs, filter]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const visible   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Stats (always computed from the full set) ─────────────────────────────────
  const total       = allRecs.length;
  const accepted    = allRecs.filter(r => r.user_decision === 'accepted');
  const acceptRate  = total > 0 ? (accepted.length / total * 100) : 0;
  const withOutcome = accepted.filter(r => r.outcome_pct_change !== null);
  const avgOutcome  = withOutcome.length > 0
    ? withOutcome.reduce((s, r) => s + (r.outcome_pct_change ?? 0), 0) / withOutcome.length
    : null;
  const winners  = withOutcome.filter(r => (r.outcome_pct_change ?? 0) > 0);
  const winRate  = withOutcome.length > 0 ? (winners.length / withOutcome.length * 100) : null;

  const countOf = (d: Filter) => d === 'all' ? total : allRecs.filter(r => r.user_decision === d).length;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',      label: `All (${total})`               },
    { key: 'pending',  label: `Pending (${countOf('pending')})` },
    { key: 'accepted', label: `Accepted (${accepted.length})` },
    { key: 'rejected', label: `Rejected (${countOf('rejected')})` },
    { key: 'watching', label: `Watching (${countOf('watching')})` },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Recommendations" />

      <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
        <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">

          {/* ── Stats bar ─────────────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E2E8F0] px-6 py-5">
            <div className="grid grid-cols-3 divide-x divide-[#E2E8F0]">
              <div className="pr-6">
                <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568] mb-1">Acceptance Rate</p>
                <p className="font-serif text-2xl font-light text-[#0A1628]">
                  {acceptRate.toFixed(0)}%
                </p>
                <p className="text-[11px] text-[#4A5568] mt-0.5">
                  {accepted.length} of {total} recommendation{total !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="px-6">
                <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568] mb-1">Avg Outcome</p>
                <p className={cn(
                  'font-serif text-2xl font-light',
                  avgOutcome === null ? 'text-[#4A5568]' : avgOutcome >= 0 ? 'text-[#166534]' : 'text-[#991b1b]',
                )}>
                  {avgOutcome === null ? '—' : `${avgOutcome >= 0 ? '+' : ''}${avgOutcome.toFixed(2)}%`}
                </p>
                <p className="text-[11px] text-[#4A5568] mt-0.5">
                  {withOutcome.length > 0 ? `${withOutcome.length} with tracked outcome` : 'No outcome data yet'}
                </p>
              </div>
              <div className="pl-6">
                <p className="text-[9px] tracking-[0.2em] uppercase text-[#4A5568] mb-1">Win Rate</p>
                <p className={cn(
                  'font-serif text-2xl font-light',
                  winRate === null ? 'text-[#4A5568]' : winRate >= 50 ? 'text-[#166534]' : 'text-[#991b1b]',
                )}>
                  {winRate === null ? '—' : `${winRate.toFixed(0)}%`}
                </p>
                <p className="text-[11px] text-[#4A5568] mt-0.5">
                  {withOutcome.length > 0
                    ? `${winners.length} of ${withOutcome.length} tracked`
                    : 'No outcome data yet'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Filter buttons ─────────────────────────────────────────────────── */}
          <div className="flex gap-px flex-wrap">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  'px-4 py-2 text-[11px] tracking-[0.12em] uppercase transition-colors',
                  filter === key
                    ? 'bg-[#0A1628] text-white'
                    : 'bg-white border border-[#E2E8F0] text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Table ─────────────────────────────────────────────────────────── */}
          {loading ? (
            <div className="bg-white border border-[#E2E8F0] divide-y divide-[#E2E8F0]">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-6">
                  <div className="h-4 w-14 animate-pulse bg-[#F8F9FA] rounded" />
                  <div className="h-4 w-8 animate-pulse bg-[#F8F9FA] rounded" />
                  <div className="h-4 flex-1 animate-pulse bg-[#F8F9FA] rounded" />
                  <div className="h-4 w-16 animate-pulse bg-[#F8F9FA] rounded" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] px-8 py-16 text-center">
              <p className="text-[10px] tracking-[0.25em] uppercase text-[#B8960C] mb-4">
                {filter === 'all' ? 'No Recommendations' : `No ${filter} recommendations`}
              </p>
              <h3 className="font-serif text-2xl font-light text-[#0A1628] mb-3">
                {filter === 'all' ? 'Nothing here yet.' : `No ${filter} recommendations.`}
              </h3>
              <p className="text-sm text-[#4A5568] max-w-sm mx-auto leading-relaxed">
                Generate recommendations from Analyze on the Dashboard or run AutoPilot.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0]">
              {/* Header — hidden on mobile */}
              <div className="hidden sm:grid sm:grid-cols-[90px_64px_56px_1fr_96px_130px_84px_28px] gap-4 px-6 py-2.5 border-b border-[#E2E8F0] bg-[#F8F9FA]">
                {['Ticker', 'Action', 'Qty', 'Reasoning', 'Decision', 'Date', 'Outcome', ''].map((h, i) => (
                  <p key={i} className="text-[9px] tracking-[0.15em] uppercase text-[#4A5568]">{h}</p>
                ))}
              </div>

              <div className="divide-y divide-[#E2E8F0]">
                {visible.map((rec) => {
                  const isExpanded = expandedId === rec.id;
                  return (
                    <div key={rec.id}>
                      {/* ── Collapsed row ─────────────────────────────── */}
                      <button
                        className="w-full text-left hover:bg-[#F8F9FA] transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                      >
                        {/* Desktop layout */}
                        <div className="hidden sm:grid sm:grid-cols-[90px_64px_56px_1fr_96px_130px_84px_28px] gap-4 px-6 py-3.5 items-center">
                          <span className="font-mono text-[13px] font-bold text-[#0A1628]">{rec.ticker}</span>
                          <span className={cn(
                            'text-[10px] tracking-[0.12em] uppercase px-2 py-0.5 font-medium inline-block text-center',
                            ACTION_BADGE[rec.action],
                          )}>
                            {rec.action}
                          </span>
                          <span className="font-mono text-[12px] text-[#4A5568] tabular-nums">{rec.qty}</span>
                          <p className="text-[12px] text-[#4A5568] line-clamp-1 leading-relaxed min-w-0">{rec.reasoning}</p>
                          <span className={cn('text-[11px] tracking-[0.08em] uppercase', DECISION_COLOR[rec.user_decision])}>
                            {rec.user_decision}
                          </span>
                          <span className="text-[11px] text-[#4A5568] tabular-nums">{fmtDate(rec.created_at)}</span>
                          <span className="font-mono text-[12px] tabular-nums">
                            <OutcomePct value={rec.outcome_pct_change} />
                          </span>
                          <span className="flex items-center justify-end text-[#4A5568]">
                            {isExpanded
                              ? <ChevronUp className="h-3.5 w-3.5" />
                              : <ChevronDown className="h-3.5 w-3.5" />}
                          </span>
                        </div>

                        {/* Mobile layout */}
                        <div className="sm:hidden px-4 py-3.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'text-[10px] tracking-[0.12em] uppercase px-1.5 py-0.5 font-medium',
                                ACTION_BADGE[rec.action],
                              )}>
                                {rec.action}
                              </span>
                              <span className="font-mono text-[13px] font-bold text-[#0A1628]">{rec.ticker}</span>
                              <span className="text-[11px] text-[#4A5568]">{rec.qty} sh</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn('text-[11px] tracking-[0.08em] uppercase', DECISION_COLOR[rec.user_decision])}>
                                {rec.user_decision}
                              </span>
                              {isExpanded
                                ? <ChevronUp className="h-3.5 w-3.5 text-[#4A5568]" />
                                : <ChevronDown className="h-3.5 w-3.5 text-[#4A5568]" />}
                            </div>
                          </div>
                          <p className="text-[12px] text-[#4A5568] line-clamp-2 leading-relaxed">{rec.reasoning}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-[#4A5568]/60">{fmtDate(rec.created_at)}</span>
                            <span className="font-mono text-[12px]">
                              <OutcomePct value={rec.outcome_pct_change} />
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* ── Expanded details ────────────────────────────── */}
                      {isExpanded && (
                        <div className="border-t border-[#E2E8F0] px-6 py-5 bg-[#F8F9FA] space-y-4">
                          <div>
                            <p className="text-[9px] tracking-[0.2em] uppercase text-[#B8960C] mb-2">Full Reasoning</p>
                            <p className="text-[13px] text-[#0A1628] font-light leading-relaxed">{rec.reasoning}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-[#4A5568]">
                            <span>Confidence: <span className="text-[#0A1628]">{rec.confidence}%</span></span>
                            <span>Source: <span className="text-[#0A1628] capitalize">{rec.source}</span></span>
                            {rec.decision_at && (
                              <span>Decision: <span className="text-[#0A1628]">{fmtDate(rec.decision_at)}</span></span>
                            )}
                            {rec.outcome_pct_change !== null && rec.outcome_date && (
                              <span>Outcome as of: <span className="text-[#0A1628]">{rec.outcome_date}</span></span>
                            )}
                          </div>
                          <div>
                            <a
                              href={`/intelligence?ticker=${rec.ticker}`}
                              className="text-[11px] tracking-[0.1em] uppercase text-[#B8960C] hover:text-[#0A1628] transition-colors"
                            >
                              View {rec.ticker} in Intelligence →
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Pagination ─────────────────────────────────────────────────────── */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[#4A5568]">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-px">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="bg-white border border-[#E2E8F0] px-4 py-2 text-[11px] tracking-[0.1em] uppercase text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page === pageCount - 1}
                  className="bg-white border border-[#E2E8F0] px-4 py-2 text-[11px] tracking-[0.1em] uppercase text-[#4A5568] hover:border-[#0A1628] hover:text-[#0A1628] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
