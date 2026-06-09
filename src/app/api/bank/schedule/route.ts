import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecurringDeposit {
  id: string;
  user_id: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  next_deposit_at: string;
  auto_invest: boolean;
  is_active: boolean;
  created_at: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

const ALLOWED_FREQUENCIES = ['weekly', 'biweekly', 'monthly'] as const;

function validatePostBody(body: unknown): {
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  auto_invest: boolean;
} {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Request body must be a JSON object');
  }

  const b = body as Record<string, unknown>;

  if (typeof b.amount !== 'number' || isNaN(b.amount)) {
    throw new Error('amount is required and must be a number');
  }
  if (b.amount < 50 || b.amount > 50_000) {
    throw new Error('amount must be between $50 and $50,000');
  }
  if (!ALLOWED_FREQUENCIES.includes(b.frequency as 'weekly' | 'biweekly' | 'monthly')) {
    throw new Error('frequency must be "weekly", "biweekly", or "monthly"');
  }

  const auto_invest = b.auto_invest !== undefined ? Boolean(b.auto_invest) : true;

  return {
    amount:      b.amount,
    frequency:   b.frequency as 'weekly' | 'biweekly' | 'monthly',
    auto_invest,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeNextDepositAt(frequency: 'weekly' | 'biweekly' | 'monthly'): string {
  const now = new Date();
  switch (frequency) {
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'biweekly':
      now.setDate(now.getDate() + 14);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
  }
  return now.toISOString();
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from('recurring_deposits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[bank/schedule GET]', error.message);
      return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
    }

    return NextResponse.json({ schedule: data as RecurringDeposit | null });
  } catch (err: unknown) {
    console.error('[bank/schedule GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let validated: ReturnType<typeof validatePostBody>;
  try {
    validated = validatePostBody(rawBody);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid request body' },
      { status: 400 },
    );
  }

  try {
    const next_deposit_at = computeNextDepositAt(validated.frequency);

    const { data, error } = await supabase
      .from('recurring_deposits')
      .upsert(
        {
          user_id:         user.id,
          amount:          validated.amount,
          frequency:       validated.frequency,
          next_deposit_at,
          auto_invest:     validated.auto_invest,
          is_active:       true,
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (error) {
      console.error('[bank/schedule POST]', error.message);
      return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
    }

    // Insert a transfer_history row for this scheduled deposit
    const { error: histError } = await supabase.from('transfer_history').insert({
      user_id:     user.id,
      amount:      validated.amount,
      type:        'deposit',
      status:      'scheduled',
      description: `Recurring ${validated.frequency} deposit scheduled`,
    });

    if (histError) {
      console.error('[bank/schedule POST] transfer_history insert:', histError.message);
      // Non-fatal
    }

    return NextResponse.json({ schedule: data as RecurringDeposit });
  } catch (err: unknown) {
    console.error('[bank/schedule POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { error } = await supabase
      .from('recurring_deposits')
      .update({ is_active: false })
      .eq('user_id', user.id);

    if (error) {
      console.error('[bank/schedule DELETE]', error.message);
      return NextResponse.json({ error: 'Failed to cancel schedule' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[bank/schedule DELETE]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
