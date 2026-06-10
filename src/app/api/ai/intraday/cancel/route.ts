import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST — cancel all pending_window trades for a given cancel_token
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let cancel_token: string | undefined;
  try {
    const body = await req.json() as { cancel_token?: string };
    cancel_token = body.cancel_token;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!cancel_token) {
    return NextResponse.json({ error: 'cancel_token required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('trades')
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)
    .eq('cancel_token', cancel_token)
    .eq('status', 'pending_window');

  if (error) {
    console.error('[intraday/cancel]', error.message);
    return NextResponse.json({ error: 'Failed to cancel trades' }, { status: 500 });
  }

  return NextResponse.json({ cancelled: true });
}
