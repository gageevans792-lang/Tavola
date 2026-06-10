import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return NextResponse.json({ count: count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const b = body as Record<string, unknown>;
    const email = b.email;
    const type  = typeof b.type === 'string' ? b.type : null;
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const supabase = await createClient();
    const row: Record<string, string> = { email: email.toLowerCase().trim() };
    if (type) row.type = type;
    const { error } = await supabase.from('waitlist').insert(row);

    if (error) {
      // Duplicate email = already on list, still return success
      if (error.code === '23505') return NextResponse.json({ ok: true });
      console.error('[waitlist] insert:', error.message);
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
