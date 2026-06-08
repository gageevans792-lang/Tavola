import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/client';

// ── Input validation ──────────────────────────────────────────────────────────

/** Minimum deposit: $1.00 in cents */
const MIN_AMOUNT = 100;

/** Maximum deposit: $1,000,000.00 in cents */
const MAX_AMOUNT = 100_000_000;

function parseBody(body: unknown): { amount: number } {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Request body must be a JSON object');
  }

  const b = body as Record<string, unknown>;

  if (typeof b.amount !== 'number') {
    throw new Error('amount is required and must be a number');
  }
  if (!Number.isInteger(b.amount)) {
    throw new Error('amount must be an integer (cents)');
  }
  if (b.amount < MIN_AMOUNT) {
    throw new Error(`amount must be at least ${MIN_AMOUNT} cents ($${MIN_AMOUNT / 100} minimum deposit)`);
  }
  if (b.amount > MAX_AMOUNT) {
    throw new Error(`amount may not exceed ${MAX_AMOUNT} cents ($${MAX_AMOUNT / 100} maximum deposit)`);
  }

  return { amount: b.amount };
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

    let validated: { amount: number };
    try {
      validated = parseBody(rawBody);
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid request body', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const { amount } = validated;

    // ── 3. Create Stripe checkout session ───────────────────────────────────────
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Tavola Deposit' },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: { user_id: user.id },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?deposit=success`,
      cancel_url:  `${process.env.NEXT_PUBLIC_BASE_URL}/deposit`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error('[stripe/create-session]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
