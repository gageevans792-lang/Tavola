import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/anthropic/client';
import { getAccount } from '@/lib/alpaca/client';

const DATA_BASE = 'https://data.alpaca.markets';

function alpacaHeaders(): HeadersInit {
  return {
    'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY!,
    'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY!,
  };
}

export interface BriefResponse {
  brief:        string;
  generated_at: string;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch last 24h news, holdings, account equity in parallel
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [newsRes, holdingsRes, account] = await Promise.allSettled([
    fetch(`${DATA_BASE}/v1beta1/news?limit=30&sort=desc&start=${encodeURIComponent(since)}`, {
      headers: alpacaHeaders(),
    }),
    supabase
      .from('holdings')
      .select('ticker, market_value, unrealized_pl, unrealized_plpc')
      .eq('user_id', user.id),
    getAccount(),
  ]);

  // ── Headlines ─────────────────────────────────────────────────────────────
  let headlines = 'No recent headlines available.';
  if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
    const newsData = await newsRes.value.json().catch(() => ({ news: [] }));
    const items = (newsData.news ?? []) as Array<{ headline: string; symbols: string[] }>;
    if (items.length > 0) {
      headlines = items
        .slice(0, 25)
        .map((n) => `• ${n.headline}${n.symbols.length ? ` [${n.symbols.slice(0, 3).join(', ')}]` : ''}`)
        .join('\n');
    }
  } else {
    console.warn('[market/brief] news fetch failed');
  }

  // ── Holdings summary ──────────────────────────────────────────────────────
  const holdings = holdingsRes.status === 'fulfilled' ? (holdingsRes.value.data ?? []) : [];
  const holdingsSummary = holdings.length > 0
    ? holdings
        .map((h) => {
          const plPct = (parseFloat(h.unrealized_plpc) * 100).toFixed(1);
          const mv    = parseFloat(h.market_value).toLocaleString('en-US', {
            style: 'currency', currency: 'USD', maximumFractionDigits: 0,
          });
          return `${h.ticker} ${mv} (${plPct}% unrealized P&L)`;
        })
        .join(', ')
    : 'No current positions';

  // ── Account equity ────────────────────────────────────────────────────────
  const acct = account.status === 'fulfilled' ? account.value : null;
  const equity = acct
    ? parseFloat(acct.equity).toLocaleString('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
      })
    : 'Unavailable';

  // ── Claude brief generation ───────────────────────────────────────────────
  const userMessage = `Portfolio equity: ${equity}
Holdings: ${holdingsSummary}

Market headlines from the past 24 hours:
${headlines}`;

  const aiResponse = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 600,
    system: `You are Tavola's Chief Investment Strategist. Write a concise, institutional-quality daily market brief for this investor.

Format your response exactly as follows (use these exact section headers, no markdown, no dashes):

MARKET OVERVIEW
[2-3 sentences on current macro conditions based on the headlines]

PORTFOLIO IMPACT
[1-2 sentences on how today's market conditions affect this specific portfolio]

KEY RISKS
· [specific risk]
· [specific risk]
· [specific risk]

OPPORTUNITIES
· [specific opportunity]
· [specific opportunity]
· [specific opportunity]

Rules: Under 250 words total. Tone: confident, precise, institutional. No emojis. Use middle dot (·) for bullet points, not dashes. Be specific to the actual holdings and headlines provided.`,
    messages: [{ role: 'user', content: userMessage }],
  });

  const brief = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';

  return NextResponse.json({
    brief,
    generated_at: new Date().toISOString(),
  } satisfies BriefResponse);
}
