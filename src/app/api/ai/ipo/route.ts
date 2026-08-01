import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';
import { createClient } from '@/lib/supabase/server';
import type { FinnhubIPO } from '@/lib/finnhub/client';

export interface IpoAnalysis {
  top_picks:         string;
  risks_to_avoid:    string;
  market_appetite:   string;
  generated_at:      string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let ipos: FinnhubIPO[];
  try { ipos = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const ipoLines = ipos.slice(0, 15).map((ipo) =>
    `  ${ipo.symbol.padEnd(8)} ${ipo.name.slice(0, 40).padEnd(40)} ${ipo.exchange.padEnd(8)} ${ipo.date}  $${ipo.price}`,
  ).join('\n');

  const prompt = `You are an institutional IPO analyst. Analyze the following upcoming IPOs and provide a concise assessment.

UPCOMING IPOs (next 30 days)
=============================
${ipoLines || '  (no IPOs scheduled)'}

Respond with ONLY a JSON object (no markdown) in this exact format:
{
  "top_picks": "one to two sentences identifying the most promising IPO(s) and why",
  "risks_to_avoid": "one sentence on which IPOs or sectors to approach cautiously and why",
  "market_appetite": "one sentence on overall IPO market sentiment and what it signals about risk appetite"
}`;

  try {
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';
    let analysis: Omit<IpoAnalysis, 'generated_at'>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch?.[0] ?? text);
    } catch {
      analysis = {
        top_picks:       'Analysis unavailable at this time.',
        risks_to_avoid:  'Exercise caution across all new listings given current market conditions.',
        market_appetite: 'IPO market sentiment data insufficient for a definitive assessment.',
      };
    }

    return NextResponse.json({ ...analysis, generated_at: new Date().toISOString() } as IpoAnalysis);
  } catch (err) {
    console.error('[ai/ipo]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Analysis unavailable' }, { status: 500 });
  }
}
