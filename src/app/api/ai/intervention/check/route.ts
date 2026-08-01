import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkAndSendIntervention } from '@/lib/ai/intervention';

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    equity:          number;
    dayChangePct:    number;
    vix:             number;
    positionChanges: Record<string, number>;
    holdings:        Array<{ ticker: string; qty: number; avg_entry_price: number; market_value: number }>;
  };

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  await checkAndSendIntervention({
    userId:          user.id,
    equity:          body.equity,
    dayChangePct:    body.dayChangePct,
    vix:             body.vix,
    positionChanges: body.positionChanges,
    holdings:        body.holdings,
    supabaseAdmin,
  });

  return NextResponse.json({ ok: true });
}
