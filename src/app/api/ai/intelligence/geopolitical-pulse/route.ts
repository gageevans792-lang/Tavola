import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/anthropic/client';
import { getMarketNews, getEconomicCalendar } from '@/lib/finnhub/client';
import { getMacroContext, buildMacroPromptSection } from '@/lib/macro/client';
import type { GeopoliticalEvent } from '@/lib/geopolitical/client';

// ── Tool schema ───────────────────────────────────────────────────────────────

const GEO_TOOL: Anthropic.Tool = {
  name: 'submit_geopolitical_analysis',
  description:
    'Submit geopolitical and market event analysis. You MUST call this tool. Do not reply in plain text.',
  input_schema: {
    type: 'object' as const,
    required: ['events'],
    properties: {
      events: {
        type: 'array',
        description: 'Top 5 market-moving events with AI analysis.',
        items: {
          type: 'object',
          required: ['headline', 'ai_analysis', 'affected_sectors', 'rotation_hedges', 'confidence', 'event_category'],
          properties: {
            headline:         { type: 'string', description: 'Concise event headline (max 120 chars)' },
            ai_analysis:      { type: 'string', description: '2-3 sentences on market impact, sector rotation implications, and investor positioning' },
            affected_sectors: {
              type: 'array',
              items: { type: 'string' },
              description: 'ETF tickers most affected (e.g. XLF, XLE, GLD, TLT)',
            },
            rotation_hedges: {
              type: 'array',
              items: { type: 'string' },
              description: 'Suggested rotation or hedge ETFs (e.g. GLD, BND, USMV)',
            },
            confidence: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Confidence in market impact assessment (0-100)',
            },
            event_category: {
              type: 'string',
              enum: ['geopolitical', 'economic', 'earnings', 'central_bank', 'commodities', 'macro'],
            },
          },
        },
      },
    },
  },
};

// ── Cron handler: fetch news, run Claude, store events ───────────────────────

async function runGeopoliticalAnalysis(): Promise<GeopoliticalEvent[]> {
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch news + macro context in parallel
  const [newsItems, economicEvents, macroCtx] = await Promise.allSettled([
    getMarketNews('general'),
    getEconomicCalendar(),
    getMacroContext(),
  ]);

  const news    = newsItems.status        === 'fulfilled' ? newsItems.value        : [];
  const econ    = economicEvents.status   === 'fulfilled' ? economicEvents.value   : [];
  const macro   = macroCtx.status         === 'fulfilled' ? macroCtx.value         : null;

  // Build context string
  const macroSection = macro ? buildMacroPromptSection(macro) : '';

  const newsText = news.slice(0, 15).map((n, i) =>
    `${i + 1}. ${n.headline} [${new Date(n.datetime * 1000).toISOString().slice(0, 10)}] — ${n.summary?.slice(0, 200) ?? ''}`
  ).join('\n');

  const econText = econ.slice(0, 8).map((e) =>
    `- ${e.event} | Country: ${e.country} | Impact: ${e.impact} | Date: ${e.time.slice(0, 10)}`
  ).join('\n');

  const contextText = [
    macroSection,
    '\nRECENT MARKET NEWS\n==================\n' + (newsText || '(no news items)'),
    '\nUPCOMING ECONOMIC EVENTS\n========================\n' + (econText || '(none in next 14 days)'),
  ].join('\n');

  // Call Claude
  const response = await anthropic.messages.create({
    model:      'claude-opus-4-8',
    max_tokens: 1500,
    system: `You are Tavola's geopolitical and market intelligence analyst. Your job is to identify the top 5 most market-moving events from the provided news and economic data, then provide institutional-grade analysis for each.

For each event you identify:
1. Assess which ETF sectors will be most impacted (positive or negative)
2. Recommend specific rotation or hedge ETFs (e.g. if geopolitical tension → GLD, BND; if strong earnings → sector ETF)
3. Rate your confidence in the market impact (0-100) based on historical precedent

Focus on events with REAL market-moving potential. Skip trivial news. Prioritize:
- Central bank decisions or signals (high confidence)
- Geopolitical tensions or resolutions affecting energy, defense, or trade
- Major earnings beats/misses for index-heavy companies
- Macro data surprises (CPI, jobs, GDP) vs consensus
- Commodity price shocks (oil, gold, agricultural)

IMPORTANT: Use ETF tickers only (SPY, QQQ, XLF, XLE, XLV, XLI, GLD, TLT, BND, USMV, VEA, VWO, etc).
FORMATTING: Never use em dashes. Use commas or colons instead.

You MUST call submit_geopolitical_analysis.`,
    tools:       [GEO_TOOL],
    tool_choice: { type: 'tool', name: 'submit_geopolitical_analysis' },
    messages: [{
      role:    'user',
      content: `Analyse these market events and provide geopolitical intelligence.\n\n${contextText}`,
    }],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );

  if (!toolBlock) return [];

  const raw = toolBlock.input as {
    events: Array<{
      headline:         string;
      ai_analysis:      string;
      affected_sectors: string[];
      rotation_hedges:  string[];
      confidence:       number;
      event_category:   string;
    }>;
  };

  const rows = raw.events.map((e) => ({
    headline:         e.headline.slice(0, 120),
    description:      '',
    source:           'finnhub',
    event_category:   e.event_category,
    ai_analysis:      e.ai_analysis,
    affected_sectors: e.affected_sectors,
    rotation_hedges:  e.rotation_hedges,
    confidence:       Math.min(100, Math.max(0, e.confidence)),
  }));

  // Prune events older than 48 hours, then insert fresh batch
  try {
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    await supabaseAdmin
      .from('geopolitical_events')
      .delete()
      .lt('created_at', cutoff);

    const { data, error } = await supabaseAdmin
      .from('geopolitical_events')
      .insert(rows)
      .select();

    if (error) console.error('[geopolitical-pulse] insert:', error.message);
    return (data ?? []) as GeopoliticalEvent[];
  } catch (err) {
    console.error('[geopolitical-pulse] DB error:', err instanceof Error ? err.message : err);
    return rows.map((r) => ({ ...r, id: '', created_at: new Date().toISOString() }));
  }
}

// ── GET: cron trigger OR user read ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const isCron = req.headers.get('x-vercel-cron') === '1';

  if (isCron) {
    // Vercel cron request — run full analysis without user auth
    try {
      const events = await runGeopoliticalAnalysis();
      return NextResponse.json({ events, source: 'fresh' });
    } catch (err) {
      console.error('[geopolitical-pulse] cron error:', err instanceof Error ? err.message : err);
      return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }
  }

  // User request — authenticate and return stored events
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '10', 10) || 10, 50);

  try {
    const { data, error } = await supabase
      .from('geopolitical_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If no stored events, run a fresh analysis for this user
    if (!data || data.length === 0) {
      const events = await runGeopoliticalAnalysis();
      return NextResponse.json({ events, source: 'fresh' });
    }

    return NextResponse.json({ events: data, source: 'cached' });
  } catch (err) {
    console.error('[geopolitical-pulse]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
