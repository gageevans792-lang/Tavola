import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecentOrders } from '@/lib/alpaca/client';

// ── Route handlers ────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orders = await withTimeout(getRecentOrders(), 8000);
    return NextResponse.json(orders);
  } catch (err: unknown) {
    console.error('[alpaca/orders GET]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 },
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: 'Direct order placement is no longer supported. Use /api/recommendations to record guidance decisions.',
      code:  'ENDPOINT_REMOVED',
    },
    { status: 405 },
  );
}
