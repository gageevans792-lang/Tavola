'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { SyncedHolding } from '@/lib/alpaca/sync';
import type { SentimentScore } from '@/lib/sentiment/engine';

function fmt(n: number, decimals = 2): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPL(n: number): string {
  return (n >= 0 ? '+' : '-') + fmt(Math.abs(n));
}

function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function sentimentColor(label: SentimentScore['sentiment_label']): string {
  if (label === 'Very Bullish') return 'text-[#166534]';
  if (label === 'Bullish')      return 'text-[#16A34A]';
  if (label === 'Neutral')      return 'text-[#4A5568]';
  if (label === 'Bearish')      return 'text-[#C41E3A]/80';
  return 'text-[#991b1b]';
}

function sentimentBorderColor(label: SentimentScore['sentiment_label']): string {
  if (label === 'Very Bullish') return 'border-[#166534]';
  if (label === 'Bullish')      return 'border-[#16A34A]';
  if (label === 'Neutral')      return 'border-[#B8960C]';
  if (label === 'Bearish')      return 'border-[#C41E3A]/80';
  return 'border-[#991b1b]';
}

interface SentimentBreakdownProps {
  s: SentimentScore;
}

function SentimentBreakdown({ s }: SentimentBreakdownProps) {
  const bars: { label: string; score: number }[] = [
    { label: 'News',     score: s.news_score     },
    { label: 'Momentum', score: s.momentum_score },
    { label: 'Analyst',  score: s.analyst_score  },
    { label: 'Insider',  score: s.insider_score  },
    { label: 'Social',   score: s.social_score   },
  ];

  return (
    <tr>
      <td colSpan={9} className="px-3 sm:px-6 py-4 bg-[#F8F9FA] border-b border-[#E2E8F0]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Sub-scores */}
          <div>
            <p className="text-[9px] tracking-[0.18em] uppercase text-[#4A5568] mb-2">Signal Breakdown</p>
            <div className="space-y-1.5">
              {bars.map(({ label, score }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-16 text-[10px] text-[#4A5568]">{label}</span>
                  <div className="flex-1 h-1.5 bg-[#E2E8F0] relative">
                    {/* Center line */}
                    <div className="absolute inset-y-0 left-1/2 w-px bg-[#0A1628]/20" />
                    {score >= 0 ? (
                      <div
                        className="absolute inset-y-0 left-1/2 bg-[#166534]"
                        style={{ width: `${Math.min(score / 2, 50)}%` }}
                      />
                    ) : (
                      <div
                        className="absolute inset-y-0 right-1/2 bg-[#991b1b]"
                        style={{ width: `${Math.min(Math.abs(score) / 2, 50)}%` }}
                      />
                    )}
                  </div>
                  <span className={cn(
                    'w-8 text-right text-[10px] font-mono',
                    score > 0 ? 'text-[#166534]' : score < 0 ? 'text-[#991b1b]' : 'text-[#4A5568]',
                  )}>
                    {score > 0 ? '+' : ''}{score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Key signals */}
          <div>
            <p className="text-[9px] tracking-[0.18em] uppercase text-[#4A5568] mb-2">Key Signals</p>
            {s.key_signals.length > 0 ? (
              <ul className="space-y-1.5">
                {s.key_signals.map((sig, i) => (
                  <li key={i} className="text-[11px] text-[#0A1628] leading-snug flex gap-1.5">
                    <span className="text-[#166534] shrink-0 mt-0.5">▲</span>
                    <span>{sig}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-[#4A5568]">No key signals detected</p>
            )}
          </div>

          {/* Risk flags */}
          <div>
            <p className="text-[9px] tracking-[0.18em] uppercase text-[#4A5568] mb-2">Risk Flags</p>
            {s.risk_flags.length > 0 ? (
              <ul className="space-y-1.5">
                {s.risk_flags.map((flag, i) => (
                  <li key={i} className="text-[11px] text-[#991b1b] leading-snug flex gap-1.5">
                    <span className="shrink-0 mt-0.5">⚠</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-[#166534]">No risk flags detected</p>
            )}
            <p className="mt-2 text-[10px] text-[#4A5568]/60">
              Confidence: {s.confidence}% · {new Date(s.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
}

interface HoldingsTableProps {
  holdings:       SyncedHolding[];
  sentimentScores?: Record<string, SentimentScore>;
  sentimentLoading?: boolean;
}

export function HoldingsTable({ holdings, sentimentScores, sentimentLoading }: HoldingsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (holdings.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-8 text-center">
        <p className="font-serif text-lg font-light text-[#0A1628] mb-1">No positions yet.</p>
        <p className="text-sm text-[#4A5568]">Run an AI analysis to get started.</p>
      </div>
    );
  }

  const totalValue    = holdings.reduce((sum, h) => sum + h.market_value, 0);
  const totalPL       = holdings.reduce((sum, h) => sum + h.unrealized_pl, 0);
  const totalPositive = totalPL >= 0;
  const hasSentiment  = !!sentimentScores;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm tabular-nums">
        <thead>
          <tr className="border-b border-[#E2E8F0]">
            <th className="px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Ticker
            </th>
            <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Shares
            </th>
            <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Avg Price
            </th>
            <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Current Price
            </th>
            <th className="px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Market Value
            </th>
            <th className="px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              P&amp;L
            </th>
            <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              P&amp;L %
            </th>
            <th className="hidden sm:table-cell px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
              Weight
            </th>
            {hasSentiment && (
              <th className="px-3 sm:px-6 py-2 text-left text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#4A5568] font-medium whitespace-nowrap">
                Sentiment
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const positive  = h.unrealized_pl >= 0;
            const sentiment = sentimentScores?.[h.ticker];
            const isExpanded = expanded === h.ticker;

            return (
              <>
                <tr
                  key={h.ticker}
                  className="border-b border-[#E2E8F0] hover:bg-[#F8F9FA] transition-colors"
                >
                  <td className="px-3 sm:px-6 py-2.5">
                    <span className="font-medium font-mono text-[11px] sm:text-[12px] text-[#0A1628] tracking-wide">{h.ticker}</span>
                  </td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-2.5 text-[#4A5568]">{h.qty}</td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-2.5 text-[#4A5568]">{fmt(h.avg_entry_price)}</td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-2.5 text-[#4A5568]">{fmt(h.current_price)}</td>
                  <td className="px-3 sm:px-6 py-2.5 text-[#0A1628] font-medium">{fmt(h.market_value, 0)}</td>
                  <td className={cn('px-3 sm:px-6 py-2.5 font-medium', positive ? 'text-[#166534]' : 'text-[#991b1b]')}>
                    {fmtPL(h.unrealized_pl)}
                  </td>
                  <td className={cn('hidden sm:table-cell px-3 sm:px-6 py-2.5 font-medium', positive ? 'text-[#166534]' : 'text-[#991b1b]')}>
                    <div className="flex items-center gap-2">
                      <span>{fmtPct(h.unrealized_plpc)}</span>
                      <div className="w-12 h-1 bg-[#E2E8F0] hidden sm:block">
                        <div
                          className={cn('h-full', positive ? 'bg-[#166534]' : 'bg-[#991b1b]')}
                          style={{ width: `${Math.min(Math.abs(h.unrealized_plpc * 100) * 2, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 sm:px-6 py-2.5 text-[#4A5568]">{h.weight_pct.toFixed(1)}%</td>
                  {hasSentiment && (
                    <td className="px-3 sm:px-6 py-2.5">
                      {sentimentLoading ? (
                        <div className="h-4 w-16 animate-pulse bg-[#E2E8F0]" />
                      ) : sentiment ? (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : h.ticker)}
                          className={cn(
                            'flex items-center gap-1.5 text-[11px] font-medium tracking-[0.04em] transition-colors',
                            sentimentColor(sentiment.sentiment_label),
                            'hover:opacity-80',
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full border',
                              sentimentBorderColor(sentiment.sentiment_label),
                              sentiment.overall_score >= 20 ? 'bg-current' : '',
                            )}
                          />
                          {sentiment.sentiment_label}
                          {sentiment.risk_flags.length > 0 && (
                            <span className="text-[#991b1b]" title={`${sentiment.risk_flags.length} risk flag(s)`}>⚠</span>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#4A5568]/40">—</span>
                      )}
                    </td>
                  )}
                </tr>
                {isExpanded && sentiment && (
                  <SentimentBreakdown key={`${h.ticker}-breakdown`} s={sentiment} />
                )}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#0A1628] bg-[#F8F9FA]">
            <td className="px-3 sm:px-6 py-2 text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[#0A1628] font-medium" colSpan={1}>
              Total
            </td>
            <td className="hidden sm:table-cell" colSpan={3} />
            <td className="px-3 sm:px-6 py-2 font-medium text-[#0A1628]">{fmt(totalValue, 0)}</td>
            <td className={cn('px-3 sm:px-6 py-2 font-medium', totalPositive ? 'text-[#166534]' : 'text-[#991b1b]')}>
              {fmtPL(totalPL)}
            </td>
            <td className="hidden sm:table-cell" colSpan={hasSentiment ? 3 : 2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
