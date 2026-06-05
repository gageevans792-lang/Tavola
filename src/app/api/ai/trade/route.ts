import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';
import { alpaca } from '@/lib/alpaca/client';

export async function POST(req: NextRequest) {
  const { symbol, action, reasoning } = await req.json();

  if (!symbol || !action) {
    return NextResponse.json({ error: 'symbol and action are required' }, { status: 400 });
  }

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Should I ${action} ${symbol}? Context: ${reasoning ?? 'no additional context'}. Reply with a brief risk assessment and a confidence score 0-100.`,
      },
    ],
  });

  const content = message.content[0];
  const assessment = content.type === 'text' ? content.text : '';

  const order = await alpaca.createOrder({
    symbol,
    qty: 1,
    side: action,
    type: 'market',
    time_in_force: 'day',
  });

  return NextResponse.json({ order, assessment });
}
