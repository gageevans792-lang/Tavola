import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: opportunities } = await supabase
    .from('harvest_opportunities')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'open')
    .order('potential_tax_savings', { ascending: false });

  const { data: ytdRows } = await supabase
    .from('tax_lots')
    .select('realized_gain_loss')
    .eq('user_id', user.id)
    .eq('closed', true)
    .gte('acquired_date', new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);

  const ytdRealizedLoss = (ytdRows ?? [])
    .reduce((sum, r) => sum + (Number(r.realized_gain_loss) < 0 ? Number(r.realized_gain_loss) : 0), 0);

  const totalPotentialSavings = (opportunities ?? [])
    .reduce((sum, o) => sum + Number(o.potential_tax_savings), 0);

  return NextResponse.json({
    opportunities: opportunities ?? [],
    ytd_realized_loss: ytdRealizedLoss,
    total_potential_savings: totalPotentialSavings,
  });
}

// Mark an opportunity as harvested (user accepted the recommendation)
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase
    .from('harvest_opportunities')
    .update({ status: 'harvested' })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
