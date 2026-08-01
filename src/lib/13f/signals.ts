/**
 * Queries institutional_holdings and builds Claude prompt sections.
 */

import { createClient } from '@supabase/supabase-js';

export interface InstitutionalSignal {
  ticker:        string;
  funds_buying:  number;   // new + increased
  funds_selling: number;   // reduced + exited
  net_flow:      'bullish' | 'bearish' | 'neutral';
  quarter:       string;
  summary:       string;   // human-readable one-liner
  top_funds:     Array<{ fund_name: string; change_type: string; pct_change: number | null; value_usd: number }>;
}

function netFlow(buying: number, selling: number): 'bullish' | 'bearish' | 'neutral' {
  if (buying > selling * 1.5 && buying >= 2) return 'bullish';
  if (selling > buying * 1.5 && selling >= 2) return 'bearish';
  return 'neutral';
}

function makeSummary(ticker: string, buying: number, selling: number, quarter: string): string {
  if (buying > 0 && selling === 0) return `${buying} tracked fund${buying !== 1 ? 's' : ''} bought/increased ${ticker} in ${quarter}`;
  if (selling > 0 && buying === 0) return `${selling} tracked fund${selling !== 1 ? 's' : ''} reduced/exited ${ticker} in ${quarter}`;
  return `${buying} fund${buying !== 1 ? 's' : ''} increased, ${selling} reduced ${ticker} in ${quarter}`;
}

/** Fetch 13F signals for given tickers from the DB. */
export async function get13FSignals(tickers: string[]): Promise<Record<string, InstitutionalSignal>> {
  if (!tickers.length) return {};

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get most recent quarter in DB
  const { data: qRow } = await supabase
    .from('institutional_holdings')
    .select('quarter')
    .order('quarter', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qRow?.quarter) return {};
  const quarter = qRow.quarter;

  const { data: rows } = await supabase
    .from('institutional_holdings')
    .select('ticker, fund_name, change_type, pct_change, value_usd, shares')
    .in('ticker', tickers)
    .eq('quarter', quarter);

  if (!rows?.length) return {};

  const signals: Record<string, InstitutionalSignal> = {};

  for (const ticker of tickers) {
    const tickerRows = rows.filter((r) => r.ticker === ticker);
    if (!tickerRows.length) continue;

    const buying  = tickerRows.filter((r) => r.change_type === 'new' || r.change_type === 'increased').length;
    const selling = tickerRows.filter((r) => r.change_type === 'reduced' || r.change_type === 'exited').length;

    signals[ticker] = {
      ticker,
      funds_buying:  buying,
      funds_selling: selling,
      net_flow:      netFlow(buying, selling),
      quarter,
      summary:       makeSummary(ticker, buying, selling, quarter),
      top_funds:     tickerRows
        .sort((a, b) => (b.value_usd ?? 0) - (a.value_usd ?? 0))
        .slice(0, 4)
        .map((r) => ({
          fund_name:   r.fund_name,
          change_type: r.change_type,
          pct_change:  r.pct_change,
          value_usd:   r.value_usd,
        })),
    };
  }

  return signals;
}

/** Build a Claude prompt section from 13F signals. */
export function build13FPromptSection(signals: Record<string, InstitutionalSignal>): string {
  const entries = Object.values(signals).filter(
    (s) => s.funds_buying + s.funds_selling >= 1,
  );
  if (!entries.length) return '';

  const lines = entries
    .sort((a, b) => (b.funds_buying - b.funds_selling) - (a.funds_buying - a.funds_selling))
    .map((s) => {
      const fundDetail = s.top_funds
        .map((f) => {
          const pct = f.pct_change != null ? ` ${f.pct_change > 0 ? '+' : ''}${f.pct_change.toFixed(0)}%` : '';
          return `${f.fund_name} ${f.change_type}${pct}`;
        })
        .join(', ');
      return `  ${s.ticker}: ${s.summary}. Funds: ${fundDetail}.`;
    });

  return `

INSTITUTIONAL POSITIONING (13F filings, ${entries[0]?.quarter ?? 'recent quarter'} — 45-day lag):
${lines.join('\n')}
Note: 13F data reflects quarter-end holdings, filed 45 days after quarter close. Treat as thesis confirmation, never as a timing signal. Cite institutional positioning in reasoning when it is material.`;
}

/** Fetch top N tickers by net institutional buying for the intelligence page. */
export async function getTopInstitutionalBuys(limit = 5): Promise<InstitutionalSignal[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) return [];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: qRow } = await supabase
    .from('institutional_holdings')
    .select('quarter')
    .order('quarter', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qRow?.quarter) return [];
  const quarter = qRow.quarter;

  const { data: rows } = await supabase
    .from('institutional_holdings')
    .select('ticker, fund_name, change_type, pct_change, value_usd, shares, filed_at')
    .eq('quarter', quarter);

  if (!rows?.length) return [];

  // Aggregate per ticker
  const byTicker = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, []);
    byTicker.get(r.ticker)!.push(r);
  }

  const results: InstitutionalSignal[] = [];
  for (const [ticker, tickerRows] of byTicker) {
    const buying  = tickerRows.filter((r) => r.change_type === 'new' || r.change_type === 'increased').length;
    const selling = tickerRows.filter((r) => r.change_type === 'reduced' || r.change_type === 'exited').length;
    if (buying === 0) continue;

    results.push({
      ticker,
      funds_buying:  buying,
      funds_selling: selling,
      net_flow:      netFlow(buying, selling),
      quarter,
      summary:       makeSummary(ticker, buying, selling, quarter),
      top_funds:     tickerRows
        .sort((a, b) => (b.value_usd ?? 0) - (a.value_usd ?? 0))
        .slice(0, 5)
        .map((r) => ({
          fund_name:   r.fund_name,
          change_type: r.change_type,
          pct_change:  r.pct_change,
          value_usd:   r.value_usd,
        })),
    });
  }

  return results
    .sort((a, b) => (b.funds_buying - b.funds_selling) - (a.funds_buying - a.funds_selling))
    .slice(0, limit);
}
