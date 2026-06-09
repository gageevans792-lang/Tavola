import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSentimentScore, getSentimentScores } from '@/lib/sentiment/engine';
import type { SentimentScore } from '@/lib/sentiment/engine';

export type { SentimentScore };

// GET /api/market/sentiment?tickers=NVDA,AAPL,MSFT
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tickersParam = request.nextUrl.searchParams.get('tickers') ?? '';
  const tickers = tickersParam
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20); // max 20

  if (!tickers.length) {
    return NextResponse.json({ error: 'tickers param required' }, { status: 400 });
  }

  try {
    const scores = await getSentimentScores(tickers);
    return NextResponse.json(Object.values(scores));
  } catch (err) {
    console.error('[sentiment GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/market/sentiment — single ticker detailed score
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { ticker?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const ticker = body.ticker?.trim().toUpperCase();
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  try {
    const score: SentimentScore = await getSentimentScore(ticker);
    return NextResponse.json(score);
  } catch (err) {
    console.error('[sentiment POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
