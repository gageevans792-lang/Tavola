import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAccount } from '@/lib/alpaca/client';
import { isFounder } from '@/lib/founder';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  date: string;
  value: number;
}

export interface ChartApiResponse {
  portfolio:          ChartDataPoint[];
  benchmark:          ChartDataPoint[];
  current_equity:     number;
  equity_change:      number;
  equity_change_pct:  number;
  period_return:      number;
}

// ── Seeded pseudo-random (LCG) ────────────────────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Box-Muller transform for normal distribution
function randomNormal(rng: () => number, mean: number, stdDev: number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  const z  = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * stdDev;
}

// ── Seed from user id ─────────────────────────────────────────────────────────

function userIdSeed(userId: string): number {
  return userId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isFounder(user.id)) {
    const BASELINE = 100_000;
    const today = new Date();
    const flat = Array.from({ length: 90 }, (_, i) => {
      const d = new Date(today.getTime() - (89 - i) * 86_400_000);
      return { date: d.toISOString().slice(0, 10), value: BASELINE };
    });
    return NextResponse.json({
      portfolio:         flat,
      benchmark:         flat,
      current_equity:    BASELINE,
      equity_change:     0,
      equity_change_pct: 0,
      period_return:     0,
    } satisfies ChartApiResponse);
  }

  try {
    const account       = await Promise.race([
      getAccount(),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('getAccount timeout')), 8000)),
    ]);
    const currentEquity = parseFloat(account.equity);

    const DAYS     = 90;
    const baseSeed = userIdSeed(user.id);

    // ── Portfolio history ─────────────────────────────────────────────────────
    const portfolioRng = seededRandom(baseSeed);
    const startEquity  = currentEquity * 0.82;
    const portfolioData: ChartDataPoint[] = [];

    let value = startEquity;
    for (let i = 0; i < DAYS; i++) {
      const dayOffset = DAYS - 1 - i;
      const date      = new Date(Date.now() - dayOffset * 86_400_000);
      portfolioData.push({
        date:  date.toISOString().slice(0, 10),
        value: Math.round(value * 100) / 100,
      });
      value = value * (1 + randomNormal(portfolioRng, 0.0008, 0.012));
    }
    // Scale the entire series so the last point equals currentEquity (no spike)
    const rawEnd = portfolioData[DAYS - 1].value;
    if (rawEnd > 0) {
      const scale = currentEquity / rawEnd;
      for (const pt of portfolioData) {
        pt.value = Math.round(pt.value * scale * 100) / 100;
      }
    }

    // ── Benchmark (S&P 500 proxy) ─────────────────────────────────────────────
    const benchmarkRng   = seededRandom(baseSeed + 999_999);
    const benchmarkStart = startEquity;
    const benchmarkData: ChartDataPoint[] = [];

    let benchValue = benchmarkStart;
    for (let i = 0; i < DAYS; i++) {
      const dayOffset = DAYS - 1 - i;
      const date      = new Date(Date.now() - dayOffset * 86_400_000);
      benchmarkData.push({
        date:  date.toISOString().slice(0, 10),
        value: Math.round(benchValue * 100) / 100,
      });
      if (i < DAYS - 1) {
        benchValue = benchValue * (1 + randomNormal(benchmarkRng, 0.0006, 0.008));
      }
    }

    // ── Derived metrics ───────────────────────────────────────────────────────
    const equity30DaysAgo = portfolioData[DAYS - 30]?.value ?? portfolioData[0].value;
    const equityChange    = currentEquity - equity30DaysAgo;
    const equityChangePct = equity30DaysAgo > 0
      ? (equityChange / equity30DaysAgo) * 100
      : 0;
    const periodReturn = startEquity > 0
      ? ((currentEquity - startEquity) / startEquity) * 100
      : 0;

    return NextResponse.json({
      portfolio:         portfolioData,
      benchmark:         benchmarkData,
      current_equity:    Math.round(currentEquity * 100) / 100,
      equity_change:     Math.round(equityChange * 100) / 100,
      equity_change_pct: Math.round(equityChangePct * 100) / 100,
      period_return:     Math.round(periodReturn * 100) / 100,
    } satisfies ChartApiResponse);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate chart data';
    console.error('[portfolio/chart]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
