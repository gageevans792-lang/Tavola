import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TRACKED_FUNDS, fetchFundHoldings, buildNameTickerMap } from '@/lib/13f/edgar';

function isVercelCron(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? '';
    return auth === `Bearer ${cronSecret}`;
  }
  return req.headers.get('x-vercel-cron') === '1';
}

export async function GET(req: Request) {
  if (!isVercelCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  console.log('[13f/sync] Starting 13F sync run');

  // Build name→ticker map once for all funds
  const nameMap = await buildNameTickerMap();
  console.log(`[13f/sync] Name map built: ${nameMap.size} entries`);

  const results = {
    synced:   0,
    skipped:  0,
    upserted: 0,
    errors:   [] as string[],
  };

  for (const [cik, fundName] of Object.entries(TRACKED_FUNDS)) {
    try {
      const filing = await fetchFundHoldings(cik, fundName, nameMap);
      if (!filing) { results.skipped++; continue; }

      console.log(`[13f/sync] ${fundName}: ${filing.holdings.length} holdings for ${filing.quarter}`);

      // Fetch prior quarter holdings for diff
      const priorHoldings = new Map<string, number>(); // ticker → shares
      const { data: prior } = await supabase
        .from('institutional_holdings')
        .select('ticker, shares')
        .eq('fund_cik', cik)
        .neq('quarter', filing.quarter);

      if (prior) {
        // Get the most recent prior quarter per ticker
        for (const row of prior) {
          if (!priorHoldings.has(row.ticker)) {
            priorHoldings.set(row.ticker, row.shares);
          }
        }
      }

      type RowData = {
        fund_name: string; fund_cik: string; ticker: string;
        shares: number; value_usd: number; quarter: string;
        change_type: 'new' | 'increased' | 'reduced' | 'exited';
        pct_change: number | null; filed_at: string | null;
      };
      // Build upsert rows
      const rows: RowData[] = filing.holdings.map((h) => {
        const prior = priorHoldings.get(h.ticker);
        let changeType: 'new' | 'increased' | 'reduced' | 'exited' = 'new';
        let pctChange: number | null = null;

        if (prior !== undefined) {
          if (h.shares > prior * 1.01) {
            changeType = 'increased';
            pctChange  = prior > 0 ? ((h.shares - prior) / prior) * 100 : null;
          } else if (h.shares < prior * 0.99) {
            changeType = 'reduced';
            pctChange  = prior > 0 ? ((h.shares - prior) / prior) * 100 : null;
          } else {
            changeType = 'increased'; // unchanged — treat as held/increased slightly
            pctChange  = 0;
          }
        }

        return {
          fund_name:   fundName,
          fund_cik:    cik,
          ticker:      h.ticker,
          shares:      h.shares,
          value_usd:   h.valueUsd,
          quarter:     filing.quarter,
          change_type: changeType,
          pct_change:  pctChange,
          filed_at:    filing.filedAt,
        };
      });

      // Handle positions exited (prior ticker not in current holdings)
      const currentTickers = new Set(filing.holdings.map((h) => h.ticker));
      for (const [ticker, shares] of priorHoldings) {
        if (!currentTickers.has(ticker)) {
          rows.push({
            fund_name:   fundName,
            fund_cik:    cik,
            ticker,
            shares:      0,
            value_usd:   0,
            quarter:     filing.quarter,
            change_type: 'exited' as const,
            pct_change:  -100,
            filed_at:    filing.filedAt,
          });
        }
      }

      if (rows.length > 0) {
        const { error } = await supabase
          .from('institutional_holdings')
          .upsert(rows, { onConflict: 'fund_cik,ticker,quarter' });

        if (error) {
          console.error(`[13f/sync] Upsert error for ${fundName}:`, error.message);
          results.errors.push(`${fundName}: ${error.message}`);
        } else {
          results.upserted += rows.length;
        }
      }

      results.synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[13f/sync] Error for ${fundName}:`, msg);
      results.errors.push(`${fundName}: ${msg}`);
    }
  }

  console.log('[13f/sync] Complete:', results);
  return NextResponse.json({ ok: true, ...results });
}
