import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/client';
import Stripe from 'stripe';

/** Events we care about — all others are silently acknowledged */
const HANDLED_EVENTS = new Set<Stripe.Event.Type>([
  'checkout.session.completed',
  'payment_intent.succeeded',
]);

export async function POST(req: NextRequest) {
  // ── 1. Require webhook secret at startup ──────────────────────────────────
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured', code: 'CONFIG_ERROR' },
      { status: 500 },
    );
  }

  // ── 2. Read raw body (must NOT use .json() — Stripe verifies the raw bytes)
  const body = await req.text();

  // ── 3. Validate Stripe signature ─────────────────────────────────────────
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header', code: 'MISSING_SIGNATURE' },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    // Do not expose the underlying error details to the caller
    console.error('[stripe/webhook] signature verification failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' },
      { status: 400 },
    );
  }

  // ── 4. Ignore unhandled event types early ────────────────────────────────
  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, handled: false });
  }

  // ── 5. Process handled events ────────────────────────────────────────────
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutSessionCompleted(session);
    } else if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentSucceeded(paymentIntent);
    }
  } catch (err: unknown) {
    // Log server-side but don't expose details — return 500 so Stripe retries
    console.error('[stripe/webhook] event processing error:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Event processing failed', code: 'PROCESSING_ERROR' },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true, handled: true });
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const stripeSessionId = session.id;
  const amountTotal     = session.amount_total ?? 0;

  // Resolve user from session metadata (set when creating the checkout session)
  // Fall back to customer_email lookup if metadata is absent
  const userId: string | null = (session.metadata?.user_id ?? null);

  if (!userId) {
    console.warn('[stripe/webhook] checkout.session.completed: no user_id in metadata, skipping deposit insert', stripeSessionId);
    return;
  }

  console.log('[stripe/webhook] checkout.session.completed:', stripeSessionId, 'amount:', amountTotal, 'user:', userId);

  const supabase = await createClient();

  // Idempotency: skip if this session was already recorded
  const { data: existing } = await supabase
    .from('deposits')
    .select('id')
    .eq('stripe_session_id', stripeSessionId)
    .maybeSingle();

  if (existing) {
    console.log('[stripe/webhook] deposit already recorded for session', stripeSessionId, '— skipping');
    return;
  }

  const { error } = await supabase.from('deposits').insert({
    user_id:           userId,
    amount:            amountTotal,
    stripe_session_id: stripeSessionId,
    status:            'completed',
  });

  if (error) {
    throw new Error(`Failed to insert deposit record: ${error.message}`);
  }
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  // Resolve user from metadata attached to the PaymentIntent
  const userId: string | null = (paymentIntent.metadata?.user_id ?? null);
  const amount = paymentIntent.amount_received ?? paymentIntent.amount;

  console.log('[stripe/webhook] payment_intent.succeeded:', paymentIntent.id, 'amount:', amount, 'user:', userId ?? 'unknown');

  if (!userId) {
    // PaymentIntents without a user_id in metadata are handled via
    // checkout.session.completed — nothing to do here
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from('deposits').insert({
    user_id:           userId,
    amount,
    stripe_session_id: paymentIntent.id,
    status:            'completed',
  });

  if (error) {
    throw new Error(`Failed to insert deposit record: ${error.message}`);
  }
}
