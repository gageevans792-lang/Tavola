import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/anthropic/client';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { risk_level, goals, time_horizon, initial_deposit, monthly_contrib } = body as {
    risk_level: string;
    goals: string[];
    time_horizon: string;
    initial_deposit: number;
    monthly_contrib: number;
  };

  const goalText = Array.isArray(goals) && goals.length > 0
    ? goals.join(' and ')
    : 'general wealth growth';

  const depositText = initial_deposit > 0
    ? `starting with $${initial_deposit.toLocaleString()}${monthly_contrib > 0 ? ` and adding $${monthly_contrib}/month` : ''}`
    : 'starting with an initial deposit';

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Write exactly 2 sentences for a personalized investment strategy summary. Be specific, institutional, and direct — no fluff, no emojis, no markdown.

Investor profile:
- Primary goals: ${goalText}
- Time horizon: ${time_horizon} years
- Risk tolerance: ${risk_level}
- Capital: ${depositText}

Sentence 1: Describe the core strategy approach suited to their risk level and goals.
Sentence 2: State one specific advantage of this approach for their timeline.`,
        },
      ],
    });

    const block = message.content[0];
    const summary = block.type === 'text' ? block.text.trim() : '';
    return NextResponse.json({ summary });
  } catch (err) {
    console.error('[onboarding-plan]', err instanceof Error ? err.message : err);
    return NextResponse.json({ summary: '' });
  }
}
