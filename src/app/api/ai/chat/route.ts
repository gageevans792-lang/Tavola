import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/anthropic/client';
import { getAccount, getPositions } from '@/lib/alpaca/client';
import Anthropic from '@anthropic-ai/sdk';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatAction {
  type: 'trade' | 'rebalance' | 'preference';
  details: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { message?: string; conversation_history?: ChatMessage[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { message, conversation_history = [] } = body;
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });

  try {
    // Fetch portfolio context (best-effort, non-fatal)
    let portfolioContext = '';
    try {
      const [account, positions] = await Promise.all([getAccount(), getPositions()]);
      const equity = parseFloat(account.equity);
      const cash = parseFloat(account.cash);
      const posLines = positions.map(p =>
        `${p.symbol}: ${p.qty} shares @ $${parseFloat(p.current_price).toFixed(2)}, P&L: ${parseFloat(p.unrealized_pl) >= 0 ? '+' : ''}$${parseFloat(p.unrealized_pl).toFixed(0)}`
      ).join('\n');
      portfolioContext = `\nClient Portfolio:\nEquity: $${equity.toFixed(2)} | Cash: $${cash.toFixed(2)}\nPositions:\n${posLines || '(no positions)'}`;
    } catch { /* non-fatal */ }

    const systemPrompt = `You are the user's personal Goldman Sachs-caliber portfolio manager at Tavola AI. You are direct, specific, confident, and data-driven. You speak with the authority of someone managing a $500M+ book of business.

Core principles:
- Always reference actual portfolio numbers from the data provided below
- Be specific: name exact percentages, dollar amounts, and tickers
- Never say "I cannot." Always find a way to help with concrete analysis or action.
- Format responses for a sophisticated investor: no jargon, but no dumbing down
- When comparing to benchmarks, be precise (S&P 500 YTD performance context)
- Lead with your conclusion, then support it with data

You can:
1. Answer questions about the portfolio with specific, data-driven analysis
2. Execute trades when asked: return a structured action object
3. Explain market conditions with institutional-grade context
4. Run scenario analysis with specific numbers ("if market drops 20%, your portfolio loses approximately $X")
5. Adjust portfolio strategy preferences
${portfolioContext}

CRITICAL: When the user asks you to make a trade or portfolio change, you MUST include a JSON action block in your response. Format it EXACTLY like this on its own line:
ACTION:{"type":"trade","details":{"symbol":"AAPL","action":"buy","qty":5,"reasoning":"User requested"}}

For rebalancing:
ACTION:{"type":"rebalance","details":{"description":"Shift to more conservative allocation"}}

For preferences:
ACTION:{"type":"preference","details":{"setting":"risk_level","value":"conservative"}}

If no action is needed, do NOT include an ACTION line. Respond in plain conversational English. No markdown headers, no bullet lists unless they genuinely aid clarity. Be concise but thorough.

FORMATTING: Never use em dashes (—) in your responses. Use commas, colons, or periods instead.`;

    const messages: Anthropic.MessageParam[] = [
      ...conversation_history.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const response = await anthropic.messages.create({
      model:      'claude-opus-4-8',
      max_tokens: 1024,
      system:     systemPrompt,
      messages,
    });

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Parse ACTION block out of response
    let action: ChatAction | undefined;
    let displayText = rawText;
    const actionMatch = rawText.match(/ACTION:(\{[\s\S]*?\})/);
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]) as ChatAction;
        displayText = rawText.replace(/ACTION:\{[\s\S]*?\}/, '').trim();
      } catch { /* malformed action — ignore */ }
    }

    return NextResponse.json({ message: displayText, action });
  } catch (err) {
    console.error('[ai/chat]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'AI temporarily unavailable' }, { status: 500 });
  }
}
