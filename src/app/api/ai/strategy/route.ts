import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { STRATEGIES, DEFAULT_STRATEGY_ID, getStrategy } from '@/lib/ai/strategies';
import type { InvestmentStrategy } from '@/lib/ai/strategies';

// ── GET — return current strategy + all strategies ────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { data: row } = await supabase
      .from('user_strategies')
      .select('strategy_id, auto_execute, max_trade_value')
      .eq('user_id', user.id)
      .maybeSingle();

    const strategyId = row?.strategy_id ?? DEFAULT_STRATEGY_ID;
    const strategy: InvestmentStrategy = getStrategy(strategyId);

    const user_prefs = row
      ? {
          auto_execute:    row.auto_execute as boolean,
          max_trade_value: row.max_trade_value as number,
        }
      : null;

    return NextResponse.json({
      strategy,
      user_prefs,
      all_strategies: STRATEGIES,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

// ── POST — update user strategy preference ────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { strategy_id?: string; auto_execute?: boolean; max_trade_value?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'BAD_REQUEST' },
      { status: 400 },
    );
  }

  const { strategy_id, auto_execute, max_trade_value } = body;

  if (!strategy_id) {
    return NextResponse.json(
      { error: 'strategy_id is required', code: 'BAD_REQUEST' },
      { status: 400 },
    );
  }

  const validIds = STRATEGIES.map((s) => s.id);
  if (!validIds.includes(strategy_id)) {
    return NextResponse.json(
      { error: `Invalid strategy_id. Must be one of: ${validIds.join(', ')}`, code: 'INVALID_STRATEGY' },
      { status: 400 },
    );
  }

  try {
    const upsertData: Record<string, unknown> = {
      user_id:     user.id,
      strategy_id,
      updated_at:  new Date().toISOString(),
    };

    if (auto_execute !== undefined) upsertData.auto_execute    = auto_execute;
    if (max_trade_value !== undefined) upsertData.max_trade_value = max_trade_value;

    const { error } = await supabase
      .from('user_strategies')
      .upsert(upsertData, { onConflict: 'user_id' });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save strategy', code: 'DB_ERROR' },
        { status: 500 },
      );
    }

    // Return updated state
    const { data: row } = await supabase
      .from('user_strategies')
      .select('strategy_id, auto_execute, max_trade_value')
      .eq('user_id', user.id)
      .maybeSingle();

    const strategy: InvestmentStrategy = getStrategy(strategy_id);

    return NextResponse.json({
      strategy,
      user_prefs: row
        ? {
            auto_execute:    row.auto_execute as boolean,
            max_trade_value: row.max_trade_value as number,
          }
        : null,
      all_strategies: STRATEGIES,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
