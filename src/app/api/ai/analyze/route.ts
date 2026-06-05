import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an expert financial analyst AI. Provide a concise, actionable analysis.\n\n${prompt}`,
      },
    ],
  });

  const content = message.content[0];
  const text = content.type === 'text' ? content.text : '';

  return NextResponse.json({
    id: crypto.randomUUID(),
    type: 'analysis',
    title: prompt.slice(0, 60) + (prompt.length > 60 ? '…' : ''),
    content: text,
    created_at: new Date().toISOString(),
  });
}
