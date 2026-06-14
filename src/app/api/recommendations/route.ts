import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/recommendations?status=pending|accepted|rejected|all
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = req.nextUrl.searchParams.get('status') ?? 'pending';
  const limit  = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10) || 50, 500);

  let query = supabase
    .from('recommendations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') {
    query = query.eq('user_decision', status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ recommendations: data ?? [] });
}

// POST /api/recommendations — create a recommendation (from UI-driven accept/reject flow)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { ticker, action, qty, reasoning, confidence, source, user_decision } = body as {
    ticker: string;
    action: string;
    qty: number;
    reasoning?: string;
    confidence?: number;
    source?: string;
    user_decision?: string;
  };

  if (!ticker || !action) {
    return NextResponse.json({ error: 'ticker and action are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('recommendations')
    .insert({
      user_id:      user.id,
      ticker,
      action,
      qty:          qty ?? 0,
      reasoning:    reasoning ?? '',
      confidence:   confidence ?? 0,
      source:       source ?? 'analysis',
      user_decision: user_decision ?? 'pending',
      decision_at:  user_decision && user_decision !== 'pending' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recommendation: data });
}
