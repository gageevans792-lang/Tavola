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

// ── Input validation ──────────────────────────────────────────────────────────

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_INSIGHT_IDS = 20;

function isUuidV4(value: string): boolean {
  return UUID_V4_RE.test(value);
}

interface ValidatedAutoInvestBody {
  insightIds: string[];
}

function parseBody(body: unknown): ValidatedAutoInvestBody {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Request body must be a JSON object');
  }

  const b = body as Record<string, unknown>;

  // Accept { insight_id: string } or { insight_ids: string[] }
  if (b.insight_ids !== undefined) {
    if (!Array.isArray(b.insight_ids)) {
      throw new Error('insight_ids must be an array of UUID v4 strings');
    }
    if (b.insight_ids.length === 0) {
      throw new Error('insight_ids must contain at least one ID');
    }
    if (b.insight_ids.length > MAX_INSIGHT_IDS) {
      throw new Error(`insight_ids may contain at most ${MAX_INSIGHT_IDS} IDs per request`);
    }
    for (const id of b.insight_ids) {
      if (typeof id !== 'string' || !isUuidV4(id)) {
        throw new Error(`All insight_ids must be valid UUID v4 strings; got "${id}"`);
      }
    }
    return { insightIds: b.insight_ids as string[] };
  }

  if (b.insight_id !== undefined) {
    if (typeof b.insight_id !== 'string' || !isUuidV4(b.insight_id)) {
      throw new Error('insight_id must be a valid UUID v4 string');
    }
    return { insightIds: [b.insight_id] };
  }

  throw new Error('Provide insight_id (string) or insight_ids (string[])');
}

// ── Insight validation ────────────────────────────────────────────────────────

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

  try {
    // ── 2. Parse + validate body ──────────────────────────────────────────────────
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }

    let validated: ValidatedAutoInvestBody;
    try {
      validated = parseBody(rawBody);
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid request body', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const insightIds = validated.insightIds;

    // ── 3. Batch-fetch all insights in one query ────────────────────────────────
    const { data: rows, error: fetchErr } = await supabase
      .from('ai_insights')
      .select('*')
      .in('id', insightIds);

    if (fetchErr) {
      return NextResponse.json(
        { error: 'Failed to fetch insights', code: 'DB_ERROR' },
        { status: 500 },
      );
    }

    const insightMap = new Map<string, AIInsight>(
      (rows ?? []).map((r) => [r.id, r as AIInsight]),
    );

    // ── 4. Batch-fetch snapshots for all valid tickers ──────────────────────────
    //    (only for insights that look executable — avoids unnecessary API calls)
    const candidateTickers = [...new Set(
      insightIds
        .map((id) => insightMap.get(id)?.ticker)
        .filter((t): t is string => !!t),
    )];

    const tickerPrices = candidateTickers.length > 0
      ? await getTickerPrices(candidateTickers)
      : {};

    // ── 5. Process each insight independently ────────────────────────────────────
    const results: TradeResult[] = [];

    for (const insightId of insightIds) {
      const insight = insightMap.get(insightId);

      try {
        // ── Validate ────────────────────────────────────────────────────────────
        assertExecutable(insight, insightId, user.id);

        const side   = insight.type as TradeSide;
        const qty    = insight.qty;                      // validated non-null by assertExecutable
        const ticker = insight.ticker;
        const price  = tickerPrices[ticker]?.price ?? 0;

        // ── Place order ─────────────────────────────────────────────────────────
        const order = await placeMarketOrder(ticker, side, qty);

        // ── Record trade (best-effort — order already placed, don't abort) ──────
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

        // ── Mark insight as executed (atomic CAS — guards against concurrent requests) ─
        const updateResult = await supabase
          .from('ai_insights')
          .update({ executed: true })
          .eq('id', insightId)
          .eq('executed', false);
        if (updateResult.error) {
          console.error(`[auto-invest] insight update failed for ${insightId}:`, updateResult.error.message);
        }

        // ── Sync holdings (best-effort — reflects new position immediately) ─────
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
  } catch (err: unknown) {
    console.error('[auto-invest]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
