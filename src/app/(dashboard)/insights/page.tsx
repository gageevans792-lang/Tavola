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

const TYPE_STYLE: Record<InsightType, string> = {
  buy:       'text-[#B8960C] border-[#B8960C]/30',
  sell:      'text-[#C41E3A] border-[#C41E3A]/30',
  hold:      'text-[#0A1628]/40 border-[#E2E8F0]',
  rebalance: 'text-[#0A1628] border-[#0A1628]/20',
  outlook:   'text-[#4A5568] border-[#E2E8F0]',
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
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">

          {/* Filter bar */}
          <div className="flex w-fit border border-[#E2E8F0] bg-white mb-6">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-5 py-2.5 text-xs tracking-[0.15em] uppercase transition-colors',
                  filter === f.value
                    ? 'bg-[#0A1628] text-white'
                    : 'text-[#4A5568] hover:text-[#0A1628] hover:bg-[#F8F9FA]',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="bg-white border border-[#E2E8F0] px-6 py-12 text-center">
              <p className="text-sm text-[#4A5568]">Loading...</p>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    {['Type', 'Ticker', 'Message', 'Confidence', 'Date', 'Status'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-[11px] tracking-[0.1em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((insight) => (
                    <tr key={insight.id} className="border-b border-[#E2E8F0] hover:bg-[#F8F9FA]">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn('text-[10px] tracking-[0.15em] uppercase border px-2 py-0.5', TYPE_STYLE[insight.type])}>
                          {insight.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-[#0A1628]">
                        {insight.ticker ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-[#4A5568] max-w-sm">
                        <p className="line-clamp-2">{insight.message}</p>
                      </td>
                      <td className="px-6 py-4 text-[#4A5568] whitespace-nowrap">
                        {insight.confidence_score !== null ? `${insight.confidence_score}%` : '—'}
                      </td>
                      <td className="px-6 py-4 text-[#4A5568] whitespace-nowrap">
                        {new Date(insight.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn('text-[11px] tracking-[0.1em] uppercase', insight.executed ? 'text-green-600' : 'text-[#4A5568]/60')}>
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
