import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/anthropic/client';
import { getAccount, getPositions } from '@/lib/alpaca/client';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Check for recent letter (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from('ai_insights')
      .select('id, message, created_at')
      .eq('user_id', user.id)
      .eq('type', 'outlook')
      .ilike('message', 'WEEKLY LETTER:%')
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      return NextResponse.json({
        letter: cached.message.replace('WEEKLY LETTER: ', ''),
        generated_at: cached.created_at,
        cached: true,
      });
    }

    return NextResponse.json({ letter: null, cached: false });
  } catch (err) {
    console.error('[ai/letter] GET:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Fetch portfolio context
    const [accountRes, positionsRes, tradesRes] = await Promise.allSettled([
      getAccount(),
      getPositions(),
      supabase
        .from('trades')
        .select('ticker, side, qty, price, ai_reasoning, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const account = accountRes.status === 'fulfilled' ? accountRes.value : null;
    const positions = positionsRes.status === 'fulfilled' ? positionsRes.value : [];
    const trades = tradesRes.status === 'fulfilled' ? (tradesRes.value.data ?? []) : [];

    const equity = account ? parseFloat(account.equity) : 0;
    const cash = account ? parseFloat(account.cash) : 0;
    const portfolioValue = equity || cash;

    const positionsSummary = positions.length > 0
      ? positions.map(p => {
          const plPct = (parseFloat(p.unrealized_plpc) * 100).toFixed(1);
          const val = parseFloat(p.market_value);
          return `${p.symbol}: ${p.qty} shares, value $${val.toFixed(0)}, P&L ${plPct}%`;
        }).join('\n')
      : 'No current positions';

    const recentTradesSummary = trades.length > 0
      ? trades.slice(0, 10).map(t => {
          const when = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return `${when}: ${t.side.toUpperCase()} ${t.qty} ${t.ticker}`;
        }).join('\n')
      : 'No recent trades';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: `You are a portfolio manager writing a weekly letter to your client, in the style of Warren Buffett's Berkshire letters: clear, honest, direct, and educational. No jargon. No em dashes. Write in plain English paragraphs. Cover: what the portfolio holds and why, what changed this week, the market environment, and the outlook. Be specific about the actual holdings and trades. Be candid about uncertainty. Sign as "Your Tavola AI Portfolio Manager".`,
      messages: [{
        role: 'user',
        content: `Write the weekly portfolio letter for this account.

Portfolio Value: $${portfolioValue.toFixed(2)}
Cash: $${cash.toFixed(2)} (${portfolioValue > 0 ? ((cash / portfolioValue) * 100).toFixed(1) : '0'}%)

Current Positions:
${positionsSummary}

Recent Trades (last 7 days):
${recentTradesSummary}

Write the letter now. Start with "Dear Investor," and end with the signature.`,
      }],
    });

    const letter = response.content[0].type === 'text' ? response.content[0].text : '';
    if (!letter) throw new Error('No letter generated');

    // Cache as an insight
    await supabase.from('ai_insights').insert({
      user_id:          user.id,
      type:             'outlook',
      ticker:           null,
      message:          `WEEKLY LETTER: ${letter}`,
      confidence_score: null,
      qty:              null,
      executed:         false,
    });

    return NextResponse.json({ letter, generated_at: new Date().toISOString(), cached: false });
  } catch (err) {
    console.error('[ai/letter] POST:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to generate letter' }, { status: 500 });
  }
}
