'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { AIInsight, InsightType } from '@/types';

// ── Weekly Letter ─────────────────────────────────────────────────────────────

interface LetterResponse {
  letter: string | null;
  generated_at?: string;
  cached?: boolean;
  error?: string;
}

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

const FILTERS: { label: string; value: InsightType | 'all' }[] = [
  { label: 'All',       value: 'all'       },
  { label: 'Buy',       value: 'buy'       },
  { label: 'Sell',      value: 'sell'      },
  { label: 'Rebalance', value: 'rebalance' },
  { label: 'Hold',      value: 'hold'      },
];

const TYPE_BADGE: Record<InsightType, string> = {
  buy:       'text-[#B8960C]',
  sell:      'text-[#C41E3A]',
  hold:      'text-[#4A5568]',
  rebalance: 'text-[#0A1628]',
  outlook:   'text-[#4A5568]',
};

function SkeletonRow() {
  return (
    <tr className="border-b border-[#E2E8F0]">
      <td className="px-6 py-4"><div className="h-3 w-10 animate-pulse bg-[#E2E8F0] rounded" /></td>
      <td className="px-6 py-4"><div className="h-3 w-12 animate-pulse bg-[#E2E8F0] rounded" /></td>
      <td className="px-6 py-4"><div className="h-3 w-48 animate-pulse bg-[#E2E8F0] rounded" /></td>
      <td className="px-6 py-4"><div className="h-3 w-8 animate-pulse bg-[#E2E8F0] rounded" /></td>
      <td className="px-6 py-4"><div className="h-3 w-20 animate-pulse bg-[#E2E8F0] rounded" /></td>
      <td className="px-6 py-4"><div className="h-3 w-14 animate-pulse bg-[#E2E8F0] rounded" /></td>
    </tr>
  );
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InsightType | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error: dbError } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (dbError) throw dbError;
      setInsights(data ?? []);
    } catch {
      setError('Unable to load insights. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = filter === 'all' ? insights : insights.filter((i) => i.type === filter);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="AI Insights" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-8">
        <div className="mx-auto max-w-5xl space-y-8">

          <div className="border-b border-[#E2E8F0] pb-6">
            <h2 className="font-serif text-2xl font-light text-[#0A1628]">AI Insights</h2>
            <p className="mt-1 text-sm text-[#4A5568]">AI-generated signals from your portfolio analysis</p>
          </div>

          <WeeklyLetterSection />

          {error && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-[#991b1b]">{error}</p>
              <button
                onClick={load}
                className="text-[11px] tracking-[0.1em] uppercase text-[#991b1b] border border-[#991b1b]/30 px-3 py-1 hover:bg-[#991b1b]/5 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 sm:gap-6 border-b border-[#E2E8F0] overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'shrink-0 pb-3 text-[11px] tracking-[0.15em] uppercase transition-colors',
                  filter === f.value
                    ? 'border-b-2 border-[#B8960C] text-[#0A1628] -mb-px'
                    : 'text-[#4A5568] hover:text-[#0A1628]',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="bg-white border border-[#E2E8F0] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    {['Type', 'Ticker', 'Message', 'Confidence', 'Date', 'Status'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
                </tbody>
              </table>
            </div>
          ) : filtered.length === 0 && !error ? (
            <div className="bg-white border border-[#E2E8F0] px-6 py-16 text-center">
              {insights.length === 0 ? (
                <>
                  <p className="font-serif text-lg font-light text-[#0A1628] mb-2">
                    No AI insights yet
                  </p>
                  <p className="text-sm text-[#4A5568] max-w-md mx-auto mb-6">
                    Start by running a portfolio analysis or configuring AutoPilot. Your AI-generated trading insights will appear here.
                  </p>
                  <Link
                    href="/dashboard"
                    className="inline-block border border-[#0A1628] px-6 py-2.5 text-[11px] tracking-[0.12em] uppercase text-[#0A1628] hover:bg-[#0A1628] hover:text-white transition-colors"
                  >
                    Go to Dashboard
                  </Link>
                </>
              ) : (
                <p className="font-serif text-lg font-light text-[#0A1628] mb-2">
                  No {filter} insights.
                </p>
              )}
            </div>
          ) : !error ? (
            <div className="bg-white border border-[#E2E8F0] overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    {['Type', 'Ticker', 'Message', 'Confidence', 'Date', 'Status'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((insight) => (
                    <tr key={insight.id} className="border-b border-[#E2E8F0] hover:bg-[#F8F9FA] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn('text-[10px] tracking-[0.15em] uppercase font-medium', TYPE_BADGE[insight.type])}>
                          {insight.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-[#0A1628] tracking-wide">
                        {insight.ticker ?? '–'}
                      </td>
                      <td className="px-6 py-4 text-[#4A5568] max-w-sm">
                        <p className="line-clamp-2 text-xs leading-relaxed">{insight.message}</p>
                      </td>
                      <td className="px-6 py-4 text-[#4A5568] whitespace-nowrap text-xs">
                        {insight.confidence_score !== null ? `${insight.confidence_score}%` : '–'}
                      </td>
                      <td className="px-6 py-4 text-[#4A5568] whitespace-nowrap text-xs">
                        {new Date(insight.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn('text-[11px] tracking-[0.12em] uppercase', insight.executed ? 'text-[#166534]' : 'text-[#4A5568]/60')}>
                          {insight.executed ? 'Executed' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

        </div>
      </main>
    </div>
  );
}
