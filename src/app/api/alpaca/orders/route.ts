import { NextRequest, NextResponse } from 'next/server';
import { getRecentOrders, placeMarketOrder } from '@/lib/alpaca/client';
import type { TradeSide } from '@/types';

export async function GET() {
  const orders = await getRecentOrders();
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { symbol, qty, side } = body as {
    symbol?: string;
    qty?: number;
    side?: TradeSide;
  };

  if (!symbol || !qty || !side) {
    return NextResponse.json(
      { error: 'symbol, qty, and side are required' },
      { status: 400 },
    );
  }

  const order = await placeMarketOrder(symbol, side, qty);
  return NextResponse.json(order, { status: 201 });
}
