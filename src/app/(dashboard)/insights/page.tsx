'use client';

import { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { AIInsight, InsightType } from '@/types';

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

export default function InsightsPage() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InsightType | 'all'>('all');

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('ai_insights')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        setInsights(data ?? []);
      } catch (err) {
        console.error('[insights] failed to load', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = filter === 'all' ? insights : insights.filter((i) => i.type === filter);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="AI Insights" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-8">
        <div className="mx-auto max-w-5xl space-y-8">

          {/* Page header */}
          <div className="border-b border-[#E2E8F0] pb-6">
            <h2 className="font-serif text-2xl font-light text-[#0A1628]">AI Insights</h2>
            <p className="mt-1 text-sm text-[#4A5568]">AI-generated signals from your portfolio analysis</p>
          </div>

          {/* Filter tabs — text with gold underline on active */}
          <div className="flex items-center gap-6 border-b border-[#E2E8F0]">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'pb-3 text-[11px] tracking-[0.15em] uppercase transition-colors',
                  filter === f.value
                    ? 'border-b-2 border-[#B8960C] text-[#0A1628] -mb-px'
                    : 'text-[#4A5568] hover:text-[#0A1628]',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="bg-white border border-[#E2E8F0] px-6 py-12 text-center">
              <p className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568]">Loading</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] px-6 py-12 text-center">
              <p className="font-serif text-lg font-light text-[#0A1628] mb-2">
                {insights.length === 0 ? 'No AI insights yet.' : `No ${filter} insights.`}
              </p>
              {insights.length === 0 && (
                <p className="text-sm text-[#4A5568]">Run your first analysis from the dashboard.</p>
              )}
            </div>
          ) : (
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
                        {insight.ticker ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-[#4A5568] max-w-sm">
                        <p className="line-clamp-2 text-xs leading-relaxed">{insight.message}</p>
                      </td>
                      <td className="px-6 py-4 text-[#4A5568] whitespace-nowrap text-xs">
                        {insight.confidence_score !== null ? `${insight.confidence_score}%` : '—'}
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
          )}

        </div>
      </main>
    </div>
  );
}
