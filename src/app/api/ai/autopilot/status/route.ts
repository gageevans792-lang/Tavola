import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AutopilotSettings {
  user_id: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  max_trade_size: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
type Frequency = (typeof VALID_FREQUENCIES)[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeNextRunAt(frequency: Frequency): string {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
  }
  return now.toISOString();
}

// ── GET: fetch current autopilot settings ─────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('autopilot_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[autopilot/status GET]', error.message);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    if (!data) {
      // Return defaults when no row exists yet
      const defaults: AutopilotSettings = {
        user_id:       user.id,
        enabled:       false,
        frequency:     'weekly',
        max_trade_size: 1000,
        last_run_at:   null,
        next_run_at:   null,
        created_at:    new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      };
      return NextResponse.json({ settings: defaults });
    }

    return NextResponse.json({ settings: data as AutopilotSettings });
  } catch (err: unknown) {
    console.error('[autopilot/status GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST: update autopilot settings ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    const b = body as Record<string, unknown>;

    // Validate frequency
    if (b.frequency !== undefined) {
      if (!VALID_FREQUENCIES.includes(b.frequency as Frequency)) {
        return NextResponse.json(
          { error: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}` },
          { status: 400 },
        );
      }
    }

    // Validate max_trade_size
    if (b.max_trade_size !== undefined) {
      const val = Number(b.max_trade_size);
      if (!isFinite(val) || val < 100 || val > 50000) {
        return NextResponse.json(
          { error: 'max_trade_size must be between 100 and 50000' },
          { status: 400 },
        );
      }
    }

    // Fetch existing settings to determine frequency for next_run_at computation
    const { data: existing } = await supabase
      .from('autopilot_settings')
      .select('frequency, enabled')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentFrequency: Frequency = (
      (b.frequency as Frequency) ?? existing?.frequency ?? 'weekly'
    );
    const becomingEnabled = b.enabled === true && !existing?.enabled;

    const upsertPayload: Record<string, unknown> = {
      user_id:    user.id,
      updated_at: new Date().toISOString(),
    };

    if (b.enabled !== undefined)        upsertPayload.enabled        = Boolean(b.enabled);
    if (b.frequency !== undefined)      upsertPayload.frequency      = b.frequency;
    if (b.max_trade_size !== undefined) upsertPayload.max_trade_size = Number(b.max_trade_size);

    // When enabling for the first time (or re-enabling), set next_run_at
    if (becomingEnabled || (b.enabled === true)) {
      upsertPayload.next_run_at = computeNextRunAt(currentFrequency);
    }

    const { data: updated, error: upsertError } = await supabase
      .from('autopilot_settings')
      .upsert(upsertPayload, { onConflict: 'user_id' })
      .select()
      .single();

    if (upsertError) {
      console.error('[autopilot/status POST]', upsertError.message);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ settings: updated as AutopilotSettings });
  } catch (err: unknown) {
    console.error('[autopilot/status POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
