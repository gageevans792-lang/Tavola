import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTickerPrices, placeMarketOrder } from '@/lib/alpaca/client';
import { syncHoldingsToSupabase } from '@/lib/alpaca/sync';
import type { AIInsight, TradeSide } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TradeResult {
  insight_id: string;
  ticker:     string | null;
  status:     'success' | 'failure';
  order_id?:  string;
  error?:     string;
}

// ── Validation helpers ────────────────────────────────────────────────────────

function assertExecutable(
  insight: AIInsight | undefined,
  insightId: string,
  userId: string,
): asserts insight is AIInsight & { ticker: string; qty: number } {
  if (!insight) {
    throw new Error('Insight not found');
  }
  if (insight.user_id !== userId) {
    throw new Error('Insight does not belong to this user');
  }
  if (insight.executed) {
    throw new Error('Insight has already been executed');
  }
  if (insight.type !== 'buy' && insight.type !== 'sell') {
    throw new Error(`Insight type "${insight.type}" is not executable — only buy/sell can be traded`);
  }
  if (!insight.ticker) {
    throw new Error('Insight has no ticker');
  }
  if (!insight.qty || insight.qty <= 0) {
    throw new Error(`Invalid quantity: ${insight.qty ?? 'null'}`);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body — accept { insight_id } or { insight_ids } ────────────────────
  const body = await req.json().catch(() => ({})) as {
    insight_id?: string;
    insight_ids?: string[];
  };

  const insightIds: string[] = Array.isArray(body.insight_ids)
    ? body.insight_ids
    : body.insight_id
    ? [body.insight_id]
    : [];

  if (insightIds.length === 0) {
    return NextResponse.json(
      { error: 'Provide insight_id (string) or insight_ids (string[])' },
      { status: 400 },
    );
  }

  // ── 2. Batch-fetch all insights in one query ──────────────────────────────────
  const { data: rows, error: fetchErr } = await supabase
    .from('ai_insights')
    .select('*')
    .in('id', insightIds);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const insightMap = new Map<string, AIInsight>(
    (rows ?? []).map((r) => [r.id, r as AIInsight]),
  );

  // ── 3. Batch-fetch snapshots for all valid tickers ────────────────────────────
  //    (only for insights that look executable — avoids unnecessary API calls)
  const candidateTickers = [...new Set(
    insightIds
      .map((id) => insightMap.get(id)?.ticker)
      .filter((t): t is string => !!t),
  )];

  const tickerPrices = candidateTickers.length > 0
    ? await getTickerPrices(candidateTickers)
    : {};

  // ── 4. Process each insight independently ─────────────────────────────────────
  const results: TradeResult[] = [];

  for (const insightId of insightIds) {
    const insight = insightMap.get(insightId);

    try {
      // ── Validate ──────────────────────────────────────────────────────────────
      assertExecutable(insight, insightId, user.id);

      const side   = insight.type as TradeSide;
      const qty    = insight.qty;                      // validated non-null by assertExecutable
      const ticker = insight.ticker;
      const price  = tickerPrices[ticker]?.price ?? 0;

      // ── Place order ───────────────────────────────────────────────────────────
      const order = await placeMarketOrder(ticker, side, qty);

      // ── Record trade (best-effort — order already placed, don't abort) ────────
      const tradeInsert = await supabase.from('trades').insert({
        user_id:          user.id,
        ticker,
        side,
        qty,
        price:            price || null,
        alpaca_order_id:  order.id,
        ai_reasoning:     insight.message,
        confidence_score: insight.confidence_score,
        status:           'pending',
      });
      if (tradeInsert.error) {
        console.error(`[auto-invest] trade insert failed for ${ticker}:`, tradeInsert.error.message);
      }

      // ── Mark insight as executed ──────────────────────────────────────────────
      const updateResult = await supabase
        .from('ai_insights')
        .update({ executed: true })
        .eq('id', insightId);
      if (updateResult.error) {
        console.error(`[auto-invest] insight update failed for ${insightId}:`, updateResult.error.message);
      }

      // ── Sync holdings (best-effort — reflects new position immediately) ───────
      syncHoldingsToSupabase(user.id).catch((err: unknown) => {
        console.error('[auto-invest] syncHoldings failed:', err instanceof Error ? err.message : err);
      });

      results.push({ insight_id: insightId, ticker, status: 'success', order_id: order.id });

    } catch (err: unknown) {
      results.push({
        insight_id: insightId,
        ticker:     insight?.ticker ?? null,
        status:     'failure',
        error:      err instanceof Error ? err.message : 'Unknown error',
      });
      // continue — never let one failure abort the batch
    }
  }

  return NextResponse.json({ results });
}
