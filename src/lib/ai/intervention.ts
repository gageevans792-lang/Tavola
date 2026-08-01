import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export interface InterventionTrigger {
  type:   'portfolio_drawdown_1d' | 'portfolio_drawdown_5d' | 'position_drawdown' | 'vix_spike' | 'consecutive_down';
  detail: string;
  severity: 'moderate' | 'severe';
}

export interface InterventionContext {
  userId:           string;
  equity:           number;
  dayChangePct:     number;   // portfolio-level intraday change %
  vix:              number;
  positionChanges:  Record<string, number>;  // ticker → intraday change %
  holdings:         Array<{ ticker: string; qty: number; avg_entry_price: number; market_value: number }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin:    SupabaseClient<any, any, any>;
}

/** Detect conditions that warrant a behavioral intervention. */
export function detectTriggers(ctx: InterventionContext): InterventionTrigger[] {
  const triggers: InterventionTrigger[] = [];

  // Portfolio down >3% in a day
  if (ctx.dayChangePct <= -3) {
    triggers.push({
      type:     'portfolio_drawdown_1d',
      detail:   `Portfolio is down ${Math.abs(ctx.dayChangePct).toFixed(1)}% today`,
      severity: ctx.dayChangePct <= -5 ? 'severe' : 'moderate',
    });
  }

  // VIX spike above 30
  if (ctx.vix >= 30) {
    triggers.push({
      type:     'vix_spike',
      detail:   `VIX at ${ctx.vix.toFixed(1)} — elevated fear gauge`,
      severity: ctx.vix >= 40 ? 'severe' : 'moderate',
    });
  }

  // Any held position down >15% from cost
  for (const holding of ctx.holdings) {
    const curPrice  = holding.avg_entry_price * (1 + (ctx.positionChanges[holding.ticker] ?? 0) / 100);
    const drawdown  = (curPrice - holding.avg_entry_price) / holding.avg_entry_price * 100;
    if (drawdown <= -15) {
      triggers.push({
        type:     'position_drawdown',
        detail:   `${holding.ticker} is down ${Math.abs(drawdown).toFixed(1)}% from cost`,
        severity: drawdown <= -25 ? 'severe' : 'moderate',
      });
      break; // one trigger per checkpoint
    }
  }

  return triggers;
}

/** Check if an intervention was already sent today for this user. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sentToday(userId: string, supabaseAdmin: SupabaseClient<any, any, any>): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data } = await supabaseAdmin
    .from('interventions')
    .select('id')
    .eq('user_id', userId)
    .gte('sent_at', startOfDay.toISOString())
    .limit(1)
    .maybeSingle();

  return !!data;
}

/** Generate and deliver a behavioral intervention via Claude. */
export async function generateIntervention(
  ctx: InterventionContext,
  trigger: InterventionTrigger,
): Promise<string | null> {
  // Max 1 intervention per user per day
  const alreadySent = await sentToday(ctx.userId, ctx.supabaseAdmin);
  if (alreadySent) return null;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const holdingsSummary = ctx.holdings
    .map((h) => {
      const chg = ctx.positionChanges[h.ticker] ?? 0;
      return `${h.ticker}: ${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% today, market value $${Number(h.market_value).toFixed(0)}`;
    })
    .join('\n');

  const systemPrompt = `You are Tavola's behavioral coach. Your job is to send a SHORT, calm, factual message to an investor experiencing a stressful market event.

RULES:
- Be steady and factual. Never dismissive of fear.
- Never falsely reassure. Never predict recovery.
- Never say "buy the dip" or any variation of it.
- Never recommend any specific action.
- Keep it under 120 words.
- Cite historical context when genuinely relevant.
- End with one concrete thing to watch (not to do).
- Do NOT use em dashes. Use commas or colons instead.`;

  const userMessage = `Trigger: ${trigger.detail}
Portfolio value: $${ctx.equity.toFixed(0)}
Intraday change: ${ctx.dayChangePct >= 0 ? '+' : ''}${ctx.dayChangePct.toFixed(1)}%
VIX: ${ctx.vix.toFixed(1)}
Holdings:
${holdingsSummary}

Write a brief, calming factual message for this investor right now.`;

  let message: string;
  try {
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userMessage }],
    });
    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    message = block?.text ?? 'Market volatility is elevated. Stay focused on your long-term plan.';
  } catch {
    message = 'Market volatility is elevated. Avoid reactive decisions. Review your position sizing when conditions settle.';
  }

  // Log to DB
  await ctx.supabaseAdmin.from('interventions').insert({
    user_id:        ctx.userId,
    trigger_type:   trigger.type,
    market_context: {
      day_change_pct: ctx.dayChangePct,
      vix:            ctx.vix,
      equity:         ctx.equity,
      trigger_detail: trigger.detail,
    },
    message,
    portfolio_value_at_intervention: ctx.equity,
  });

  // Send in-app notification
  await ctx.supabaseAdmin.from('notifications').insert({
    user_id:    ctx.userId,
    type:       'info',
    title:      'Market Update from Tavola',
    message:    message.slice(0, 200),
    ticker:     null,
    read:       false,
    priority:   'normal',
    action_url: '/intelligence',
  });

  return message;
}

/** Main entry point: check and send intervention if warranted. */
export async function checkAndSendIntervention(ctx: InterventionContext): Promise<void> {
  try {
    const triggers = detectTriggers(ctx);
    if (triggers.length === 0) return;

    // Use the most severe trigger
    const primary = triggers.sort((a, b) =>
      (b.severity === 'severe' ? 1 : 0) - (a.severity === 'severe' ? 1 : 0),
    )[0];

    await generateIntervention(ctx, primary);
  } catch (err) {
    console.error('[intervention] failed:', err instanceof Error ? err.message : err);
  }
}
