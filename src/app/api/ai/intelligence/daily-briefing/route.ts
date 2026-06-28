import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/anthropic/client';
import { getEconomicCalendar } from '@/lib/finnhub/client';
import { getMacroContext, buildMacroPromptSection } from '@/lib/macro/client';

// ── Tool schema ───────────────────────────────────────────────────────────────

interface BriefingRec {
  ticker:     string;
  thesis:     string;
  confidence: number;
}

const BRIEFING_TOOL: Anthropic.Tool = {
  name: 'submit_daily_briefing',
  description:
    'Submit the daily strategy briefing with exactly 3 buy recs, 3 avoid ideas, and a market outlook paragraph. You MUST call this tool.',
  input_schema: {
    type: 'object' as const,
    required: ['buys', 'avoids', 'outlook'],
    properties: {
      buys: {
        type: 'array',
        description: 'Exactly 3 ETF buy recommendations for today.',
        items: {
          type: 'object',
          required: ['ticker', 'thesis', 'confidence'],
          properties: {
            ticker:     { type: 'string', description: 'Uppercase ETF ticker' },
            thesis:     { type: 'string', description: 'One sentence rationale referencing current macro/geopolitical data' },
            confidence: { type: 'integer', minimum: 50, maximum: 100 },
          },
        },
      },
      avoids: {
        type: 'array',
        description: 'Exactly 3 ETFs or sectors to avoid or reduce today.',
        items: {
          type: 'object',
          required: ['ticker', 'thesis', 'confidence'],
          properties: {
            ticker:     { type: 'string', description: 'Uppercase ETF ticker' },
            thesis:     { type: 'string', description: 'One sentence rationale for avoidance referencing current data' },
            confidence: { type: 'integer', minimum: 50, maximum: 100 },
          },
        },
      },
      outlook: {
        type: 'string',
        description: '3-4 sentence macro market outlook for today: key drivers, risk environment, and top investment theme to watch.',
      },
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

// ── Core briefing generator ───────────────────────────────────────────────────

async function generateBriefing() {
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const today = todayET();

  // Check if today's briefing already exists
  const { data: existing } = await supabaseAdmin
    .from('daily_briefings')
    .select('*')
    .eq('briefing_date', today)
    .maybeSingle();

  if (existing) return existing;

  // Fetch market data in parallel
  const [macroCtx, econEvents, geoRows] = await Promise.allSettled([
    getMacroContext(),
    getEconomicCalendar(),
    supabaseAdmin
      .from('geopolitical_events')
      .select('headline, ai_analysis, affected_sectors, rotation_hedges, confidence')
      .order('created_at', { ascending: false })
      .limit(5)
      .then((r) => r.data ?? [], () => []),
  ]);

  const macro    = macroCtx.status  === 'fulfilled' ? macroCtx.value  : null;
  const econ     = econEvents.status === 'fulfilled' ? econEvents.value : [];
  const geoEvts  = geoRows.status   === 'fulfilled' ? geoRows.value   : [];

  const macroSection = macro ? buildMacroPromptSection(macro) : '';

  const econText = econ
    .filter((e) => e.impact === 'high')
    .slice(0, 6)
    .map((e) => `- ${e.event} | ${e.time.slice(0, 10)} | Impact: ${e.impact}`)
    .join('\n') || '(no high-impact events in next 14 days)';

  const geoText = (geoEvts as Array<{ headline: string; ai_analysis: string; confidence: number }>)
    .map((e, i) => `${i + 1}. [${e.confidence}%] ${e.headline}: ${e.ai_analysis}`)
    .join('\n') || '(no geopolitical events on file)';

  const contextBlock = [
    macroSection,
    '\nUPCOMING ECONOMIC CATALYSTS\n============================\n' + econText,
    '\nGEOPOLITICAL INTELLIGENCE (live)\n=================================\n' + geoText,
  ].join('\n');

  // Call Claude
  const response = await anthropic.messages.create({
    model:      'claude-opus-4-8',
    max_tokens: 1200,
    system: `You are Tavola's senior macro strategist. Each morning before market open you produce a concise, actionable daily briefing for a sophisticated retail investor.

ETF universe to choose from:
BUY candidates: SPY, QQQ, VTI, XLF, XLE, XLV, XLI, XLY, XLK, GLD, SCHD, TLT, VEA, VWO, IWM, USMV, TIP, VNQ
AVOID candidates: VIXY, TLT, XLP, XLU, HYG, any overextended sector ETF from the macro data

Rules:
- Reference the actual macro data provided. Do not hallucinate events.
- Buy thesis and avoid thesis must each be exactly ONE clear sentence.
- Confidence minimum 50, be honest — only recommend things you have strong data-backed conviction on.
- Outlook: 3-4 sentences maximum. Identify the single most important market driver today.
- NEVER use em dashes. Use commas or colons instead.

You MUST call submit_daily_briefing.`,
    tools:       [BRIEFING_TOOL],
    tool_choice: { type: 'tool', name: 'submit_daily_briefing' },
    messages: [{
      role:    'user',
      content: `Generate today's (${formatDate(today)}) daily strategy briefing.\n\n${contextBlock}`,
    }],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );

  if (!toolBlock) throw new Error('Claude did not return a tool_use block');

  const raw = toolBlock.input as {
    buys:    BriefingRec[];
    avoids:  BriefingRec[];
    outlook: string;
  };

  // Upsert today's briefing
  const { data, error } = await supabaseAdmin
    .from('daily_briefings')
    .upsert({
      briefing_date: today,
      buys:          raw.buys,
      avoids:        raw.avoids,
      outlook:       raw.outlook,
    }, { onConflict: 'briefing_date' })
    .select()
    .single();

  if (error) throw new Error(`DB upsert failed: ${error.message}`);
  return data;
}

// ── GET: cron trigger OR user read ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const isCron = req.headers.get('x-vercel-cron') === '1';

  if (isCron) {
    try {
      const briefing = await generateBriefing();
      return NextResponse.json({ briefing, source: 'generated' });
    } catch (err) {
      console.error('[daily-briefing] cron error:', err instanceof Error ? err.message : err);
      return NextResponse.json({ error: 'Briefing generation failed' }, { status: 500 });
    }
  }

  // User request — authenticate
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = req.nextUrl.searchParams.get('date') ?? todayET();

  try {
    const { data, error } = await supabase
      .from('daily_briefings')
      .select('*')
      .eq('briefing_date', date)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!data) {
      // No briefing yet for today — generate one on-demand
      const briefing = await generateBriefing();
      return NextResponse.json({ briefing, source: 'fresh' });
    }

    return NextResponse.json({ briefing: data, source: 'cached' });
  } catch (err) {
    console.error('[daily-briefing]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
