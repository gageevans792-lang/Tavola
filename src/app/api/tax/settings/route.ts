import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('tax_settings')
    .select('marginal_rate, state_tax_enabled, state_tax_rate, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    settings: {
      marginal_rate:     data?.marginal_rate     ?? 0.24,
      state_tax_enabled: data?.state_tax_enabled ?? false,
      state_tax_rate:    data?.state_tax_rate    ?? 0.00,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    user_id:    user.id,
    updated_at: new Date().toISOString(),
  };

  if (typeof body.marginal_rate === 'number') {
    if (body.marginal_rate < 0 || body.marginal_rate > 0.60) {
      return NextResponse.json({ error: 'marginal_rate must be between 0 and 0.60' }, { status: 400 });
    }
    payload.marginal_rate = body.marginal_rate;
  }
  if (typeof body.state_tax_enabled === 'boolean') payload.state_tax_enabled = body.state_tax_enabled;
  if (typeof body.state_tax_rate === 'number') {
    if (body.state_tax_rate < 0 || body.state_tax_rate > 0.25) {
      return NextResponse.json({ error: 'state_tax_rate must be between 0 and 0.25' }, { status: 400 });
    }
    payload.state_tax_rate = body.state_tax_rate;
  }

  const { data, error } = await supabase
    .from('tax_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
