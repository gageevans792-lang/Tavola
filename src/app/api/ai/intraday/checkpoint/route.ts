import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getTickerPrices } from '@/lib/alpaca/client';
import { anthropic } from '@/lib/anthropic/client';
import { applyRiskGuard } from '@/lib/ai/risk-guard';
import { isFounder } from '@/lib/founder';
import { evaluateTriggers } from '@/lib/intraday/triggers';
import type { TradeRecommendation, AutoInvestConfig } from '@/types';

// ── Scheduled checkpoint times (ET, expressed in UTC) ────────────────────────
const CHECKPOINT_SCHEDULE = [
  { label: '9:35am',  utcHour: 14, utcMin: 35 },
  { label: '1:00pm',  utcHour: 18, utcMin:  0 },
  { label: '3:30pm',  utcHour: 20, utcMin: 30 },
] as const;

type CheckpointTime = typeof CHECKPOINT_SCHEDULE[number]['label'];

const CHECKPOINT_TOOL: Anthropic.Tool = {
  name: 'submit_checkpoint_review',
  description:
    'Submit a targeted intraday checkpoint review. Max 2 trade recommendations. You MUST call this tool.',
  input_schema: {
    type:     'object' as const,
    required: ['recommendations', 'summary'],
    properties: {
      recommendations: {
        type: 'array',
        description: 'At most 2 targeted trade recommendations. Only recommend when confidence >= 75.',
        items: {
          type: 'object',
          required: ['ticker', 'action', 'qty', 'confidence', 'reasoning'],
          properties: {
            ticker:     { type: 'string' },
            action:     { type: 'string', enum: ['buy', 'sell', 'hold'] },
            qty:        { type: 'number', minimum: 0 },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            reasoning:  { type: 'string', description: 'Must name the specific trigger that prompted this.' },
          },
        },
      },
      summary: { type: 'string', description: 'Brief plain-English summary of the checkpoint.' },
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isMarketOpen(now: Date): boolean {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  return mins >= 14 * 60 + 30 && mins < 21 * 60; // 14:30–21:00 UTC = 9:30am–4:00pm ET
}

function detectCheckpointLabel(now: Date): CheckpointTime {
  for (const { label, utcHour, utcMin } of CHECKPOINT_SCHEDULE) {
    const diffMins = Math.abs(now.getUTCHours() * 60 + now.getUTCMinutes() - (utcHour * 60 + utcMin));
    if (diffMins <= 10) return label;
  }
  return '9:35am'; // fallback for manual triggers
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendNotification(userId: string, payload: {
  type:        'risk' | 'profit' | 'info';
  title:       string;
  message:     string;
  ticker?:     string;
  priority?:   'normal' | 'low';
  action_url?: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}, supabaseAdmin: any) {
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id:    userId,
      type:       payload.type,
      title:      payload.title,
      message:    payload.message,
      ticker:     payload.ticker ?? null,
      priority:   payload.priority ?? 'normal',
      action_url: payload.action_url ?? null,
    });
  } catch (err) {
    console.warn('[checkpoint] sendNotification failed:', err instanceof Error ? err.message : err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logCheckpoint(opts: {
  userId:           string;
  checkpointTime:   CheckpointTime;
  triggersFired:    string[];
  positionsReviewed: string[];
  actionTaken:      'none' | 'pending_window' | 'limit_reached';
  tradesCount:      number;
  summary:          string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin:    any;
}) {
  try {
    await opts.supabaseAdmin.from('checkpoint_log').insert({
      user_id:            opts.userId,
      checkpoint_time:    opts.checkpointTime,
      triggers_fired:     opts.triggersFired,
      positions_reviewed: opts.positionsReviewed,
      action_taken:       opts.actionTaken,
      trades_count:       opts.tradesCount,
      summary:            opts.summary,
    });
  } catch (err) {
    console.warn('[checkpoint] logCheckpoint failed:', err instanceof Error ? err.message : err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getNotifSettings(userId: string, supabaseAdmin: any) {
  try {
    const { data } = await supabaseAdmin
      .from('user_notification_settings')
      .select('pre_trade_alerts, execution_confirmations, checkpoint_summaries')
      .eq('user_id', userId)
      .maybeSingle();
    return {
      pre_trade_alerts:        data?.pre_trade_alerts        ?? true,
      execution_confirmations: data?.execution_confirmations ?? true,
      checkpoint_summaries:    data?.checkpoint_summaries    ?? true,
    };
  } catch {
    return { pre_trade_alerts: true, execution_confirmations: true, checkpoint_summaries: true };
  }
}

// ── Convert elapsed pending_window trades into recommendation rows ─────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executePendingWindowTrades(userId: string, supabaseAdmin: any) {
  const now = new Date().toISOString();

  const { data: pending } = await supabaseAdmin
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending_window')
    .lte('pending_until', now);

  if (!pending || pending.length === 0) return;

  for (const trade of pending) {
    try {
      await supabaseAdmin.from('recommendations').insert({
        user_id:       userId,
        ticker:        trade.ticker,
        action:        trade.side,
        qty:           Number(trade.qty),
        reasoning:     trade.ai_reasoning ?? '',
        confidence:    trade.confidence_score ?? 75,
        source:        'intraday',
        user_decision: 'pending',
      });
      await supabaseAdmin.from('trades').update({ status: 'cancelled' }).eq('id', trade.id);
    } catch (err) {
      console.error(`[checkpoint] create recommendation ${trade.id}:`, err instanceof Error ? err.message : err);
      await supabaseAdmin.from('trades').update({ status: 'cancelled' }).eq('id', trade.id);
    }
  }
}

// ── Claude targeted review ────────────────────────────────────────────────────
async function callClaudeForCheckpoint(opts: {
  holdings:       Array<{ ticker: string; qty: number; avg_entry_price: number; market_value: number }>;
  triggers:       Array<{ type: string; ticker?: string; detail: string }>;
  currentPrices:  Record<string, number>;
  positionChanges: Record<string, number>;
  equity:         number;
  buyingPower:    number;
  maxTradeSize:   number;
}): Promise<{ recommendations: TradeRecommendation[]; summary: string }> {
  const { holdings, triggers, currentPrices, positionChanges, equity, buyingPower, maxTradeSize } = opts;

  const triggerList = triggers.map((t) => `  - [${t.type}] ${t.detail}`).join('\n');
  const posLines    = holdings.map((h) => {
    const chg = positionChanges[h.ticker] ?? 0;
    const cur  = currentPrices[h.ticker]  ?? h.avg_entry_price;
    return `  ${h.ticker.padEnd(6)} qty=${h.qty} avg=$${Number(h.avg_entry_price).toFixed(2)} cur=$${cur.toFixed(2)} intraday=${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%  mv=$${Number(h.market_value).toFixed(0)}`;
  }).join('\n');

  const systemPrompt = `You are Tavola's intraday risk monitor. An automated checkpoint has detected market signals requiring review.

FORMATTING: Never use em dashes. Use commas or colons instead.

MANDATE:
- Review ONLY the affected positions listed below
- Recommend AT MOST 2 trades total
- Confidence MUST be >= 75 or do not recommend
- Your reasoning MUST name the specific trigger (from TRIGGERS DETECTED)
- Do not recommend panic selling. Prefer holding unless signal is clearly actionable.
- Buy notional must not exceed $${maxTradeSize} per trade
- This is scheduled intelligence, not reactive panic trading

Portfolio equity: $${equity.toFixed(0)} | Buying power: $${buyingPower.toFixed(0)}

TRIGGERS DETECTED:
${triggerList}

CURRENT POSITIONS:
${posLines || '  (none)'}

You MUST call submit_checkpoint_review. Do not reply in plain text.`;

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system:     systemPrompt,
    tools:      [CHECKPOINT_TOOL],
    tool_choice: { type: 'tool', name: 'submit_checkpoint_review' },
    messages: [{
      role:    'user',
      content: 'Run the intraday checkpoint review for the triggered positions.',
    }],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );

  if (!toolBlock) return { recommendations: [], summary: 'Checkpoint review returned no recommendations.' };

  const raw = toolBlock.input as {
    recommendations: Array<{ ticker: string; action: string; qty: number; confidence: number; reasoning: string }>;
    summary: string;
  };

  const recommendations: TradeRecommendation[] = (raw.recommendations ?? [])
    .filter((r) => r.confidence >= 75 && r.action !== 'hold' && r.qty > 0)
    .slice(0, 2)
    .map((r) => ({
      symbol:     r.ticker,
      action:     r.action as 'buy' | 'sell' | 'hold',
      qty:        r.qty,
      confidence: r.confidence,
      reasoning:  r.reasoning,
      risk_level: 'medium' as const,
    }));

  return { recommendations, summary: raw.summary ?? '' };
}

// ── Per-user checkpoint runner ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runCheckpointForUser(userId: string, supabaseAdmin: any, checkpointTime: CheckpointTime) {
  // Step 0: Execute any pending_window trades whose window has elapsed
  await executePendingWindowTrades(userId, supabaseAdmin);

  // Step 1: Count intraday trades today (pending_until IS NOT NULL = intraday)
  const today = new Date().toISOString().slice(0, 10);
  const { count: intradayCount } = await supabaseAdmin
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .not('pending_until', 'is', null)
    .neq('status', 'cancelled');

  // Step 2: Get holdings
  const { data: holdingRows } = await supabaseAdmin
    .from('holdings')
    .select('ticker, qty, avg_entry_price, market_value')
    .eq('user_id', userId);

  const holdings = (holdingRows ?? []) as Array<{ ticker: string; qty: number; avg_entry_price: number; market_value: number }>;
  const heldTickers = holdings.map((h) => h.ticker);

  if (heldTickers.length === 0) {
    await logCheckpoint({
      userId, checkpointTime, triggersFired: [], positionsReviewed: [],
      actionTaken: 'none', tradesCount: 0,
      summary: 'No positions to review.', supabaseAdmin,
    });
    return { action: 'none', reason: 'no_holdings' };
  }

  // Step 3: Evaluate market triggers
  const ctx = await evaluateTriggers(heldTickers);

  if (ctx.triggers.length === 0) {
    const spyStr   = `${ctx.spyChangePct >= 0 ? '+' : ''}${ctx.spyChangePct.toFixed(2)}%`;
    const summary  = `Reviewed ${heldTickers.join(', ')}. SPY ${spyStr} intraday. All ${heldTickers.length} position${heldTickers.length !== 1 ? 's' : ''} within tolerance. No action required.`;

    await logCheckpoint({
      userId, checkpointTime, triggersFired: [], positionsReviewed: heldTickers,
      actionTaken: 'none', tradesCount: 0, summary, supabaseAdmin,
    });

    const notifSettings = await getNotifSettings(userId, supabaseAdmin);
    if (notifSettings.checkpoint_summaries) {
      await sendNotification(userId, {
        type:       'info',
        title:      `${checkpointTime} checkpoint: no action needed`,
        message:    `${heldTickers.length} position${heldTickers.length !== 1 ? 's' : ''} reviewed. SPY ${spyStr} intraday. Portfolio within tolerance.`,
        priority:   'low',
        action_url: '/autopilot',
      }, supabaseAdmin);
    }

    return { action: 'none', triggers: 0 };
  }

  // Step 4: Daily intraday trade limit (4 per account)
  if ((intradayCount ?? 0) >= 4) {
    const triggerSummary = ctx.triggers.map((t) => t.detail).join('; ');
    await logCheckpoint({
      userId, checkpointTime,
      triggersFired:     ctx.triggers.map((t) => t.detail),
      positionsReviewed: heldTickers,
      actionTaken:       'limit_reached',
      tradesCount:       0,
      summary:           `${ctx.triggers.length} trigger${ctx.triggers.length > 1 ? 's' : ''} detected but daily intraday trade limit reached (4/4). ${triggerSummary}`,
      supabaseAdmin,
    });
    return { action: 'limit_reached', triggers: ctx.triggers.length };
  }

  // Step 5: Determine equity / buying power for the prompt
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();
  const founderUser = isFounder(userId, profile?.email);

  let equity      = holdings.reduce((s, h) => s + Number(h.market_value), 0);
  let buyingPower = 0;

  if (founderUser) {
    try {
      const { getAccount } = await import('@/lib/alpaca/client');
      const acct = await getAccount();
      equity      = parseFloat(acct.equity);
      buyingPower = parseFloat(acct.buying_power);
    } catch { /* use holdings total */ }
  } else {
    const { data: acctRow } = await supabaseAdmin
      .from('user_accounts').select('cash').eq('user_id', userId).maybeSingle();
    buyingPower = acctRow ? Number(acctRow.cash) : 0;
    equity      = equity + buyingPower;
  }

  const { data: settingsRow } = await supabaseAdmin
    .from('autopilot_settings').select('max_trade_size').eq('user_id', userId).maybeSingle();
  const maxTradeSize = Number(settingsRow?.max_trade_size ?? 5000);

  // Step 6: Call Claude for targeted review
  const { recommendations, summary: claudeSummary } = await callClaudeForCheckpoint({
    holdings,
    triggers:        ctx.triggers,
    currentPrices:   ctx.currentPrices,
    positionChanges: ctx.positionChanges,
    equity,
    buyingPower,
    maxTradeSize,
  });

  if (recommendations.length === 0) {
    await logCheckpoint({
      userId, checkpointTime,
      triggersFired:     ctx.triggers.map((t) => t.detail),
      positionsReviewed: heldTickers,
      actionTaken:       'none',
      tradesCount:       0,
      summary:           claudeSummary || 'Triggers detected but no trade recommended after review.',
      supabaseAdmin,
    });
    return { action: 'none', triggers: ctx.triggers.length };
  }

  // Step 7: Apply guardrails (same-day sell block + diversification via risk guard)
  const { data: todayTrades } = await supabaseAdmin
    .from('trades')
    .select('ticker, side')
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .eq('side', 'buy');

  const todayBuyTickers = new Set((todayTrades ?? []).map((t: { ticker: string }) => t.ticker));

  const guardConfig: AutoInvestConfig = {
    mode:                 'auto',
    confidence_threshold: 75,
    max_trade_value:      maxTradeSize,
    max_position_pct:     0.20,
    watchlist:            heldTickers,
  };

  const positionValues: Record<string, number> = {};
  for (const h of holdings) positionValues[h.ticker] = Number(h.market_value);

  const latestPrices: Record<string, number> = ctx.currentPrices;

  const { approved } = applyRiskGuard(recommendations, guardConfig, {
    portfolioValue:        equity,
    availableCash:         buyingPower,
    currentPositionValues: positionValues,
    latestPrices,
  });

  const filteredRecs = approved
    .filter((r) => !(r.action === 'sell' && todayBuyTickers.has(r.symbol)))
    .slice(0, 2);

  if (filteredRecs.length === 0) {
    await logCheckpoint({
      userId, checkpointTime,
      triggersFired:     ctx.triggers.map((t) => t.detail),
      positionsReviewed: heldTickers,
      actionTaken:       'none',
      tradesCount:       0,
      summary:           'Recommendations filtered by risk guardrails. No trades queued.',
      supabaseAdmin,
    });
    return { action: 'none', triggers: ctx.triggers.length };
  }

  // Step 8: Insert pending_window trade rows (15-minute delay)
  const pendingUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const cancelToken  = crypto.randomUUID();

  const tradeRows = filteredRecs.map((r) => ({
    user_id:          userId,
    ticker:           r.symbol,
    side:             r.action,
    qty:              r.qty,
    price:            ctx.currentPrices[r.symbol] ?? null,
    ai_reasoning:     r.reasoning,
    confidence_score: r.confidence,
    status:           'pending_window',
    pending_until:    pendingUntil,
    cancel_token:     cancelToken,
    simulated:        !founderUser,
    trigger_type:     ctx.triggers[0]?.type ?? 'intraday',
  }));

  const { error: insertErr } = await supabaseAdmin.from('trades').insert(tradeRows);
  if (insertErr) {
    console.error('[checkpoint] trade insert:', insertErr.message);
    return { action: 'error', error: insertErr.message };
  }

  // Step 9: Pre-action notification
  const tradeDescs    = filteredRecs.map((r) => `${r.action.toUpperCase()} ${r.qty} ${r.symbol}`).join(', ');
  const triggerSummary = ctx.triggers.slice(0, 2).map((t) => t.detail).join('; ');

  const notifSettings = await getNotifSettings(userId, supabaseAdmin);
  if (notifSettings.pre_trade_alerts) {
    await sendNotification(userId, {
      type:       'risk',
      title:      `Tavola will adjust your portfolio (${checkpointTime})`,
      message:    `Planned: ${tradeDescs}. Trigger: ${triggerSummary}. Executes in 15 min unless cancelled.`,
      priority:   'normal',
      action_url: `/autopilot?cancel=${cancelToken}`,
    }, supabaseAdmin);
  }

  // Step 10: Log checkpoint
  const logSummary = `${ctx.triggers.length} trigger${ctx.triggers.length > 1 ? 's' : ''}: ${triggerSummary}. Queued: ${tradeDescs}. Executes at ${new Date(pendingUntil).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`;
  await logCheckpoint({
    userId, checkpointTime,
    triggersFired:     ctx.triggers.map((t) => t.detail),
    positionsReviewed: heldTickers,
    actionTaken:       'pending_window',
    tradesCount:       filteredRecs.length,
    summary:           logSummary,
    supabaseAdmin,
  });

  return { action: 'pending_window', triggers: ctx.triggers.length, trades: filteredRecs.length, cancelToken };
}

// ── GET: Vercel cron (CRON_SECRET header) OR user session ────────────────────
// Vercel crons always send GET. If the CRON_SECRET header is present we delegate
// to the POST cron logic so the scheduled checkpoints actually run.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') ?? req.headers.get('x-cron-secret');
  if (cronSecret && cronSecret.length > 0 && authHeader === `Bearer ${cronSecret}`) {
    return POST(req);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const today = new Date().toISOString().slice(0, 10);

  const { data: checkpoints } = await supabaseAdmin
    .from('checkpoint_log')
    .select('*')
    .eq('user_id', user.id)
    .gte('run_at', `${today}T00:00:00.000Z`)
    .order('run_at', { ascending: true });

  // Also return any pending_window trades (so UI can show cancel option)
  const { data: pendingTrades } = await supabaseAdmin
    .from('trades')
    .select('id, ticker, side, qty, cancel_token, pending_until, ai_reasoning')
    .eq('user_id', user.id)
    .eq('status', 'pending_window')
    .gte('created_at', `${today}T00:00:00.000Z`);

  return NextResponse.json({
    checkpoints:   checkpoints ?? [],
    pendingTrades: pendingTrades ?? [],
  });
}

// ── POST: cron-triggered checkpoint run ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length === 0 || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  if (!isMarketOpen(now)) {
    return NextResponse.json({ skipped: true, reason: 'market_closed' });
  }

  const checkpointTime = detectCheckpointLabel(now);
  console.log('[intraday/checkpoint] Running checkpoint:', checkpointTime);

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: autopilotUsers } = await supabaseAdmin
    .from('autopilot_settings')
    .select('user_id')
    .eq('enabled', true);

  const results = [];
  for (const { user_id } of autopilotUsers ?? []) {
    try {
      const result = await runCheckpointForUser(user_id, supabaseAdmin, checkpointTime);
      results.push({ user_id, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[intraday/checkpoint] user', user_id, ':', msg);
      results.push({ user_id, error: msg });
    }
  }

  console.log(`[intraday/checkpoint] Processed ${results.length} users`);
  return NextResponse.json({ checkpoint: checkpointTime, processed: results.length, results });
}
