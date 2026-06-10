import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface NotificationSettings {
  pre_trade_alerts:        boolean;
  execution_confirmations: boolean;
  checkpoint_summaries:    boolean;
  weekly_letter:           boolean;
}

const DEFAULTS: NotificationSettings = {
  pre_trade_alerts:        true,
  execution_confirmations: true,
  checkpoint_summaries:    true,
  weekly_letter:           true,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('user_notification_settings')
    .select('pre_trade_alerts, execution_confirmations, checkpoint_summaries, weekly_letter')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ settings: data ?? DEFAULTS });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let patch: Partial<NotificationSettings>;
  try {
    patch = await req.json() as Partial<NotificationSettings>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowed: (keyof NotificationSettings)[] = [
    'pre_trade_alerts', 'execution_confirmations', 'checkpoint_summaries', 'weekly_letter',
  ];
  const safe: Partial<NotificationSettings> = {};
  for (const key of allowed) {
    if (typeof patch[key] === 'boolean') safe[key] = patch[key];
  }

  const { error } = await supabase
    .from('user_notification_settings')
    .upsert(
      { user_id: user.id, ...safe, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[notifications/settings PATCH]', error.message);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }

  const { data: updated } = await supabase
    .from('user_notification_settings')
    .select('pre_trade_alerts, execution_confirmations, checkpoint_summaries, weekly_letter')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ settings: updated ?? { ...DEFAULTS, ...safe } });
}
