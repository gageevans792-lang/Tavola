import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { anthropic } from '@/lib/anthropic/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MarketRegime = 'bull' | 'bear' | 'neutral';

export interface CommentaryResponse {
  commentary: string;
  generated_at: string;
  market_regime: MarketRegime;
}

interface Mover {
  symbol: string;
  price: number;
  changePct: number;
}

interface MoversData {
  gainers: Mover[];
  losers: Mover[];
}

interface Article {
  headline: string;
  source: string;
}

// ── In-process cache (1 hour) ─────────────────────────────────────────────────

interface CacheEntry {
  data: CommentaryResponse;
  expiresAt: number;
}

let commentaryCache: CacheEntry | null = null;

// ── Fallback commentary ───────────────────────────────────────────────────────

const FALLBACK_COMMENTARY =
  'Market data is temporarily unavailable. Our systems are working to restore full market analysis capabilities. ' +
  'Please check back shortly for updated market commentary and sector analysis. ' +
  'In the interim, consult primary market data sources for current price action and position management decisions.';

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRegime(gainers: Mover[], losers: Mover[]): MarketRegime {
  const topGain = gainers[0]?.changePct ?? 0;
  const topLoss = losers[0]?.changePct ?? 0; // already negative
  if (topGain > 2 && gainers.length > losers.length) return 'bull';
  if (topLoss < -2 && losers.length > gainers.length) return 'bear';
  return 'neutral';
}

function formatMover(m: Mover, isGainer: boolean): string {
  const sign = isGainer ? '+' : '';
  return `${m.symbol} (${sign}${m.changePct.toFixed(2)}% @ $${m.price.toFixed(2)})`;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();

  if (commentaryCache && now < commentaryCache.expiresAt) {
    return NextResponse.json(commentaryCache.data);
  }

  // ── Fetch movers ────────────────────────────────────────────────────────────

  let gainers: Mover[] = [];
  let losers: Mover[] = [];

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const moversRes = await fetch(`${baseUrl}/api/market/movers`, {
      cache: 'no-store',
    });
    if (moversRes.ok) {
      const data = (await moversRes.json()) as MoversData;
      gainers = data.gainers ?? [];
      losers = data.losers ?? [];
    }
  } catch {
    // non-fatal — continue with empty movers
  }

  // ── Fetch news ──────────────────────────────────────────────────────────────

  let headlines: string[] = [];

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const newsRes = await fetch(`${baseUrl}/api/market/news`, {
      cache: 'no-store',
    });
    if (newsRes.ok) {
      const data = (await newsRes.json()) as { articles: Article[] };
      headlines = (data.articles ?? [])
        .slice(0, 5)
        .map((a) => `- ${a.headline} (${a.source})`);
    }
  } catch {
    // non-fatal — continue with no headlines
  }

  // ── Compute market regime ───────────────────────────────────────────────────

  const market_regime = computeRegime(gainers, losers);

  // ── Build prompt context ────────────────────────────────────────────────────

  const gainersText =
    gainers.length > 0
      ? gainers.map((g) => formatMover(g, true)).join(', ')
      : 'No significant gainers today';

  const losersText =
    losers.length > 0
      ? losers.map((l) => formatMover(l, false)).join(', ')
      : 'No significant losers today';

  const headlinesText =
    headlines.length > 0 ? headlines.join('\n') : '- No recent headlines available';

  // ── Call Claude ─────────────────────────────────────────────────────────────

  let commentary = FALLBACK_COMMENTARY;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system:
        'You are a senior equity research analyst at an institutional investment firm. Write concise, professional market commentary. No emojis, no markdown headers. Use institutional financial language. Three paragraphs, each 2-3 sentences.',
      messages: [
        {
          role: 'user',
          content:
            `Market data for ${new Date().toDateString()}:\n\n` +
            `Top Gainers: ${gainersText}\n` +
            `Top Losers: ${losersText}\n\n` +
            `Recent Headlines:\n${headlinesText}\n\n` +
            `Write a market commentary for institutional investors.`,
        },
      ],
    });

    const block = message.content[0];
    if (block.type === 'text' && block.text.trim()) {
      commentary = block.text.trim();
    }
  } catch {
    // Use fallback commentary
  }

  // ── Build and cache response ────────────────────────────────────────────────

  const payload: CommentaryResponse = {
    commentary,
    generated_at: new Date().toISOString(),
    market_regime,
  };

  commentaryCache = { data: payload, expiresAt: now + 60 * 60 * 1_000 };
  return NextResponse.json(payload);
}
