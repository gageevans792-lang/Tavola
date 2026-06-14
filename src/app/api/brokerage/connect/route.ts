import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_PROVIDERS = ['fidelity', 'robinhood', 'schwab', 'etrade', 'vanguard'];

// GET /api/brokerage/connect — return user's brokerage connection status
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('brokerages')
    .select('provider, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ brokerages: data ?? [] });
}

// POST /api/brokerage/connect — record connection intent
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const provider = (body.provider as string ?? '').toLowerCase();

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('brokerages')
    .upsert(
      { user_id: user.id, provider, status: 'requested', updated_at: new Date().toISOString() },
      { onConflict: 'user_id,provider' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok:       true,
    provider,
    status:   'requested',
    message:  `Your ${provider} connection request has been recorded. We'll notify you when integration is available.`,
    brokerage: data,
  });
}
