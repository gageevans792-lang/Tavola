import { NextRequest, NextResponse } from 'next/server';
import { alpaca } from '@/lib/alpaca/client';

export async function GET() {
  const orders = await alpaca.getOrders({ status: 'all', limit: 50, until: undefined, after: undefined, direction: undefined, nested: undefined, symbols: undefined });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { symbol, qty, side, type = 'market', time_in_force = 'day' } = body;

  if (!symbol || !qty || !side) {
    return NextResponse.json({ error: 'symbol, qty, and side are required' }, { status: 400 });
  }

  const order = await alpaca.createOrder({ symbol, qty, side, type, time_in_force });
  return NextResponse.json(order, { status: 201 });
}
