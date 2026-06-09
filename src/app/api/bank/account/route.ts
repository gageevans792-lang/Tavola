import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BankAccount {
  id: string;
  user_id: string;
  bank_name: string;
  account_type: 'checking' | 'savings';
  last_four: string;
  routing_number: string | null;
  is_verified: boolean;
  connected_at: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

const LAST_FOUR_RE = /^\d{4}$/;
const ALLOWED_ACCOUNT_TYPES = ['checking', 'savings'] as const;

function validatePostBody(body: unknown): {
  bank_name: string;
  account_type: 'checking' | 'savings';
  last_four: string;
  routing_number?: string;
} {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Request body must be a JSON object');
  }

  const b = body as Record<string, unknown>;

  if (typeof b.bank_name !== 'string' || b.bank_name.trim().length === 0) {
    throw new Error('bank_name is required');
  }
  if (b.bank_name.trim().length > 50) {
    throw new Error('bank_name must be 50 characters or fewer');
  }
  if (!ALLOWED_ACCOUNT_TYPES.includes(b.account_type as 'checking' | 'savings')) {
    throw new Error('account_type must be "checking" or "savings"');
  }
  if (typeof b.last_four !== 'string' || !LAST_FOUR_RE.test(b.last_four)) {
    throw new Error('last_four must be exactly 4 digits');
  }
  if (b.routing_number !== undefined && typeof b.routing_number !== 'string') {
    throw new Error('routing_number must be a string');
  }

  return {
    bank_name:      b.bank_name.trim(),
    account_type:   b.account_type as 'checking' | 'savings',
    last_four:      b.last_four,
    routing_number: typeof b.routing_number === 'string' ? b.routing_number : undefined,
  };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[bank/account GET]', error.message);
      return NextResponse.json({ error: 'Failed to fetch bank account' }, { status: 500 });
    }

    return NextResponse.json({ account: data as BankAccount | null });
  } catch (err: unknown) {
    console.error('[bank/account GET]', err instanceof Error ? err.message : err);
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
    const { data, error } = await supabase
      .from('bank_connections')
      .upsert(
        {
          user_id:        user.id,
          bank_name:      validated.bank_name,
          account_type:   validated.account_type,
          last_four:      validated.last_four,
          routing_number: validated.routing_number ?? null,
          connected_at:   new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (error) {
      console.error('[bank/account POST]', error.message);
      return NextResponse.json({ error: 'Failed to save bank account' }, { status: 500 });
    }

    return NextResponse.json({ account: data as BankAccount });
  } catch (err: unknown) {
    console.error('[bank/account POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [connResult, schedResult] = await Promise.all([
      supabase.from('bank_connections').delete().eq('user_id', user.id),
      supabase.from('recurring_deposits').delete().eq('user_id', user.id),
    ]);

    if (connResult.error) {
      console.error('[bank/account DELETE] bank_connections:', connResult.error.message);
      return NextResponse.json({ error: 'Failed to disconnect bank account' }, { status: 500 });
    }
    if (schedResult.error) {
      console.error('[bank/account DELETE] recurring_deposits:', schedResult.error.message);
      // Non-fatal — bank connection already removed
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[bank/account DELETE]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
