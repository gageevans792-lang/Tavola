import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH /api/recommendations/[id] — record user decision (accepted | rejected | watching | pending)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const decision = body.decision as string;
  const valid = ['accepted', 'rejected', 'watching', 'pending'];
  if (!valid.includes(decision)) {
    return NextResponse.json({ error: `decision must be one of: ${valid.join(', ')}` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('recommendations')
    .update({
      user_decision: decision,
      decision_at:   decision !== 'pending' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ recommendation: data });
}
