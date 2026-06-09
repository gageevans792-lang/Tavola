import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic/client';
import type { CryptoBar } from '@/lib/alpaca/client';

interface CryptoAnalysis {
  market_regime:   string;
  top_opportunity: string;
  risk_warning:    string;
  generated_at:    string;
}

export async function POST(request: Request) {
  let prices: CryptoBar[];
  try { prices = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const priceLines = prices
    .filter((p) => p.price > 0)
    .map((p) => {
      const sign = p.change_pct_24h >= 0 ? '+' : '';
      return `  ${p.symbol.padEnd(10)} $${p.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}  ${sign}${p.change_pct_24h.toFixed(2)}% (24h)`;
    })
    .join('\n');

  const prompt = `You are a crypto market analyst. Analyze the following live crypto prices and provide a concise institutional assessment.

LIVE CRYPTO PRICES
==================
${priceLines || '  (no price data available)'}

Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "market_regime": "one sentence: bull/bear/accumulation phase with brief reasoning",
  "top_opportunity": "one sentence: the single best risk/reward opportunity right now and why",
  "risk_warning": "one sentence: the primary risk to watch and what would invalidate the thesis"
}`;

  try {
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages:   [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';
    let analysis: Omit<CryptoAnalysis, 'generated_at'>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch?.[0] ?? text);
    } catch {
      analysis = {
        market_regime:   'Mixed signals across the crypto market.',
        top_opportunity: 'No clear opportunity identified at this time.',
        risk_warning:    'Elevated volatility — maintain disciplined position sizing.',
      };
    }

    return NextResponse.json({ ...analysis, generated_at: new Date().toISOString() } as CryptoAnalysis);
  } catch (err) {
    console.error('[ai/crypto]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Analysis unavailable' }, { status: 500 });
  }
}
