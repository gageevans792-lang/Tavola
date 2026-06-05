import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';
import { placeMarketOrder } from '@/lib/alpaca/client';
import type { TradeSide } from '@/types';

export async function POST(req: NextRequest) {
  const { symbol, action, reasoning } = await req.json() as {
    symbol?: string;
    action?: TradeSide;
    reasoning?: string;
  };

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

  const block = message.content[0];
  const assessment = block.type === 'text' ? block.text : '';

  const order = await placeMarketOrder(symbol, action, 1);

  return NextResponse.json({ order, assessment });
}
