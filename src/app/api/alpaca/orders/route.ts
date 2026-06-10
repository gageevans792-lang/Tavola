import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecentOrders, getTickerPrices, placeMarketOrder } from '@/lib/alpaca/client';
import type { TradeSide } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Fallback price per share when live price is unavailable */
const FALLBACK_PRICE_PER_SHARE = 500;

/** Maximum notional value for a single order */
const MAX_ORDER_NOTIONAL = 50_000;

// ── Input validation ──────────────────────────────────────────────────────────

const SYMBOL_RE = /^[A-Z0-9]{1,10}$/;

interface ValidatedOrderBody {
  symbol: string;
  qty:    number;
  side:   TradeSide;
}

function parseBody(body: unknown): ValidatedOrderBody {
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

  // qty — required, positive finite number, ≤ 10000
  if (typeof b.qty !== 'number' || !isFinite(b.qty) || b.qty <= 0) {
    throw new Error('qty must be a positive number');
  }
  if (b.qty > 10_000) {
    throw new Error('qty may not exceed 10,000 shares per order');
  }
  const qty = b.qty;

  // side — must be "buy" or "sell"
  if (b.side !== 'buy' && b.side !== 'sell') {
    throw new Error('side must be "buy" or "sell"');
  }
  const side = b.side as TradeSide;

  return { symbol, qty, side };
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orders = await getRecentOrders();
    return NextResponse.json(orders);
  } catch (err: unknown) {
    console.error('[alpaca/orders GET]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Failed to fetch orders', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

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

    let validated: ValidatedOrderBody;
    try {
      validated = parseBody(rawBody);
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid request body', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const { symbol, qty, side } = validated;

    // ── 3. Fetch live price to enforce max order value ──────────────────────────
    let pricePerShare = FALLBACK_PRICE_PER_SHARE;
    const priceUnavailable: boolean = await (async () => {
      try {
        const prices = await getTickerPrices([symbol]);
        const info = prices[symbol];
        if (info && !info.price_unavailable && info.price > 0) {
          pricePerShare = info.price;
          return false;
        }
      } catch (err: unknown) {
        console.warn('[alpaca/orders] price fetch failed:', err instanceof Error ? err.message : err);
      }
      return true;
    })();

    const estimatedNotional = qty * pricePerShare;
    if (estimatedNotional > MAX_ORDER_NOTIONAL) {
      const priceNote = priceUnavailable
        ? ` (price unavailable: used $${FALLBACK_PRICE_PER_SHARE}/share estimate)`
        : ` (price: $${pricePerShare.toFixed(2)}/share)`;
      return NextResponse.json(
        {
          error: `Order notional $${estimatedNotional.toFixed(2)} exceeds the $${MAX_ORDER_NOTIONAL.toLocaleString()} per-order limit${priceNote}`,
          code: 'ORDER_TOO_LARGE',
        },
        { status: 422 },
      );
    }

    // ── 4. Log trade attempt to Supabase before placing ─────────────────────────
    const { error: logErr } = await supabase.from('trades').insert({
      user_id: user.id,
      ticker:  symbol,
      side,
      qty,
      price:   priceUnavailable ? null : pricePerShare,
      status:  'pending',
    });
    if (logErr) {
      console.error('[alpaca/orders] trade log failed:', logErr.message);
    }

    // ── 5. Place order with Alpaca ───────────────────────────────────────────────
    let order;
    try {
      order = await placeMarketOrder(symbol, side, qty);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Order placement failed';
      console.error('[alpaca/orders] placeMarketOrder error:', message);
      return NextResponse.json(
        { error: message, code: 'ORDER_FAILED' },
        { status: 502 },
      );
    }

    return NextResponse.json(order, { status: 201 });
  } catch (err: unknown) {
    console.error('[alpaca/orders POST]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
