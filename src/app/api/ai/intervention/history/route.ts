import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: interventions } = await supabase
    .from('interventions')
    .select('id, trigger_type, message, sent_at, portfolio_value_at_intervention, outcome_30d')
    .eq('user_id', user.id)
    .order('sent_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ interventions: interventions ?? [] });
}
