import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Transfer {
  id: string;
  user_id: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  status: string;
  description: string | null;
  created_at: string;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('transfer_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[bank/transfers GET]', error.message);
    return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
  }

  return NextResponse.json({ transfers: (data ?? []) as Transfer[] });
}
