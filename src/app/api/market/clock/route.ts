import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClockResponse {
  is_open:    boolean;
  next_open:  string;
  next_close: string;
  timestamp:  string;
}

// ── In-process cache (30 seconds) ─────────────────────────────────────────────

interface CacheEntry {
  data:      ClockResponse;
  expiresAt: number;
}

let clockCache: CacheEntry | null = null;

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();

  if (clockCache && now < clockCache.expiresAt) {
    return NextResponse.json(clockCache.data);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(
        `${process.env.ALPACA_BASE_URL ?? 'https://paper-api.alpaca.markets'}/v2/clock`,
        {
          headers: {
            'APCA-API-KEY-ID':     process.env.ALPACA_API_KEY!,
            'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY!,
          },
          signal: controller.signal,
          cache:  'no-store',
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`Alpaca clock API responded with ${res.status}`);
    }

    const json = await res.json();

    const payload: ClockResponse = {
      is_open:    Boolean(json.is_open),
      next_open:  json.next_open  ?? '',
      next_close: json.next_close ?? '',
      timestamp:  json.timestamp  ?? new Date().toISOString(),
    };

    clockCache = { data: payload, expiresAt: now + 30 * 1_000 };
    return NextResponse.json(payload);

  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[market/clock] request timeout');
    } else {
      console.error('[market/clock]', err instanceof Error ? err.message : err);
    }

    // Graceful fallback: estimate based on NYSE hours
    const nowDate  = new Date();
    const utcHour  = nowDate.getUTCHours();
    const utcMin   = nowDate.getUTCMinutes();
    const day      = nowDate.getUTCDay(); // 0=Sun, 6=Sat
    const isWeekday = day >= 1 && day <= 5;
    // NYSE: 9:30–16:00 ET = 14:30–21:00 UTC
    const isMarketHours =
      isWeekday &&
      (utcHour > 14 || (utcHour === 14 && utcMin >= 30)) &&
      utcHour < 21;

    return NextResponse.json({
      is_open:    isMarketHours,
      next_open:  '',
      next_close: '',
      timestamp:  nowDate.toISOString(),
    } satisfies ClockResponse);
  }
}
