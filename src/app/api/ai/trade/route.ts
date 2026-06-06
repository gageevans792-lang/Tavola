import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/anthropic/client';
import { placeMarketOrder } from '@/lib/alpaca/client';
import type { TradeSide } from '@/types';

// ── Input validation ──────────────────────────────────────────────────────────

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYMBOL_RE  = /^[A-Z0-9]{1,10}$/;

interface ValidatedTradeBody {
  symbol:      string;
  action:      TradeSide;
  reasoning?:  string;
  qty:         number;
  insight_id?: string;
}

function parseBody(body: unknown): ValidatedTradeBody {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Request body must be a JSON object');
  }

  const b = body as Record<string, unknown>;

  // symbol — required, alphanumeric, ≤ 10 chars (transform to uppercase)
  if (typeof b.symbol !== 'string' || b.symbol.trim() === '') {
    throw new Error('symbol is required and must be a non-empty string');
  }
  const symbol = b.symbol.trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) {
    throw new Error('symbol must be alphanumeric and at most 10 characters');
  }

  // action — must be "buy" or "sell"
  if (b.action !== 'buy' && b.action !== 'sell') {
    throw new Error('action must be "buy" or "sell"');
  }
  const action = b.action as TradeSide;

  // qty — optional, defaults to 1, must be positive finite ≤ 10000
  let qty = 1;
  if (b.qty !== undefined) {
    if (typeof b.qty !== 'number' || !isFinite(b.qty) || b.qty <= 0 || b.qty > 10000) {
      throw new Error('qty must be a positive number no greater than 10000');
    }
    qty = b.qty;
  }

  // reasoning — optional string
  const reasoning = typeof b.reasoning === 'string' ? b.reasoning : undefined;

  // insight_id — optional UUID v4
  let insight_id: string | undefined;
  if (b.insight_id !== undefined) {
    if (typeof b.insight_id !== 'string' || !UUID_V4_RE.test(b.insight_id)) {
      throw new Error('insight_id must be a valid UUID v4');
    }
    insight_id = b.insight_id;
  }

  return { symbol, action, reasoning, qty, insight_id };
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
    // ── 2. Parse + validate body ────────────────────────────────────────────────
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }

    let validated: ValidatedTradeBody;
    try {
      validated = parseBody(rawBody);
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid request body', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const { symbol, action, reasoning, qty } = validated;

    // ── 3. AI risk assessment ───────────────────────────────────────────────────
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Should I ${action} ${symbol}? Context: ${reasoning ?? 'no additional context'}. Reply with a brief risk assessment and a confidence score 0-100.`,
        },
      ],
    });

    const block = message.content[0];
    const assessment = block.type === 'text' ? block.text : '';

    // ── 4. Place order ──────────────────────────────────────────────────────────
    const order = await placeMarketOrder(symbol, action, qty);

    // ── 5. Log trade to Supabase (best-effort) ──────────────────────────────────
    const tradeInsert = await supabase.from('trades').insert({
      user_id:         user.id,
      ticker:          symbol,
      side:            action,
      qty,
      alpaca_order_id: order.id,
      ai_reasoning:    reasoning ?? null,
      status:          'pending',
    });
    if (tradeInsert.error) {
      console.error('[ai/trade] trade log failed:', tradeInsert.error.message);
    }

    return NextResponse.json({ order, assessment });
  } catch (err: unknown) {
    console.error('[ai/trade]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
