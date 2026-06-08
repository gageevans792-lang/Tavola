import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/anthropic/client';
import { getEconomicCalendar } from '@/lib/finnhub/client';
import Anthropic from '@anthropic-ai/sdk';

export interface PredictiveSignal {
  id?:               string;
  event:             string;
  date:              string;
  days_until:        number;
  affected_tickers:  string[];
  recommended_action: 'increase' | 'reduce' | 'hedge' | 'hold';
  reasoning:         string;
  confidence:        number;
}

const SIGNAL_TOOL: Anthropic.Tool = {
  name: 'submit_predictive_signals',
  description: 'Submit predictive positioning signals for upcoming economic events. You MUST call this tool.',
  input_schema: {
    type: 'object' as const,
    required: ['signals'],
    properties: {
      signals: {
        type: 'array',
        items: {
          type: 'object',
          required: ['event', 'date', 'affected_tickers', 'recommended_action', 'reasoning', 'confidence'],
          properties: {
            event:              { type: 'string' },
            date:               { type: 'string', description: 'YYYY-MM-DD' },
            affected_tickers:   { type: 'array', items: { type: 'string' } },
            recommended_action: { type: 'string', enum: ['increase', 'reduce', 'hedge', 'hold'] },
            reasoning:          { type: 'string', description: '2-3 sentences on why and what to do' },
            confidence:         { type: 'integer', minimum: 0, maximum: 100 },
          },
        },
      },
    },
  },
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // ── 1. Fetch upcoming high-impact economic events ──────────────────────
    const allEvents = await getEconomicCalendar();
    const now = Date.now();

    const upcomingEvents = allEvents
      .filter(e => e.impact === 'high')
      .map(e => {
        const eventDate = new Date(e.time);
        const days_until = Math.round((eventDate.getTime() - now) / 86_400_000);
        return { ...e, days_until };
      })
      .filter(e => e.days_until >= 0 && e.days_until <= 14)
      .slice(0, 6);

    if (upcomingEvents.length === 0) {
      return NextResponse.json({ signals: [] });
    }

    // ── 2. Build events text for Claude ───────────────────────────────────
    const eventsText = upcomingEvents.map(e =>
      `- ${e.event} | Date: ${e.time.slice(0, 10)} | In ${e.days_until} days | Impact: ${e.impact}`
    ).join('\n');

    // ── 3. Call Claude for predictions ────────────────────────────────────
    const response = await anthropic.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 1500,
      system: `You are a macro-driven quantitative strategist. Given upcoming high-impact economic events, generate precise pre-positioning recommendations for ETF investors.

Focus on ETFs and index funds: VTI, VOO, QQQ, SPY, IWM, VEA, VWO, BND, GLD, SCHD, VGT, TLT, SHY, VIXY, XLF, XLE, XLU, XLV.

For each event, identify:
1. Which specific tickers will be most affected and HOW (e.g. rate-sensitive sectors before Fed meeting)
2. Directional bias: should investors increase exposure, reduce it, hedge, or hold ahead of the event?
3. Confidence based on historical patterns

Be specific and actionable. Reference historical patterns (e.g. "GLD typically rallies 2-3% in the 5 days before Fed meetings when the market expects cuts").

You MUST call submit_predictive_signals.`,
      tools:       [SIGNAL_TOOL],
      tool_choice: { type: 'tool', name: 'submit_predictive_signals' },
      messages: [{
        role:    'user',
        content: `Generate predictive positioning signals for these upcoming events:\n\n${eventsText}`,
      }],
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (!toolBlock) {
      return NextResponse.json({ signals: [] });
    }

    const raw = toolBlock.input as { signals: Array<{
      event: string; date: string; affected_tickers: string[];
      recommended_action: 'increase' | 'reduce' | 'hedge' | 'hold';
      reasoning: string; confidence: number;
    }>};

    // ── 4. Add days_until to each signal ──────────────────────────────────
    const signals: PredictiveSignal[] = raw.signals.map(s => {
      const eventDate = new Date(s.date);
      const days_until = Math.round((eventDate.getTime() - now) / 86_400_000);
      return { ...s, days_until: Math.max(0, days_until) };
    });

    // ── 5. Save to Supabase (best-effort) ────────────────────────────────
    try {
      const rows = signals.map(s => ({
        user_id:            user.id,
        event:              s.event,
        event_date:         s.date,
        affected_tickers:   s.affected_tickers,
        action:             s.recommended_action,
        reasoning:          s.reasoning,
        confidence:         s.confidence,
      }));
      // Delete old signals for this user before inserting fresh ones
      await supabase.from('predictive_signals').delete().eq('user_id', user.id);
      await supabase.from('predictive_signals').insert(rows);
    } catch {
      // Table may not exist yet — non-fatal
    }

    return NextResponse.json({ signals });
  } catch (err) {
    console.error('[ai/predict]', err instanceof Error ? err.message : err);
    return NextResponse.json({ signals: [] });
  }
}
