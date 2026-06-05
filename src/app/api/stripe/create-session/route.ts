import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';

export async function POST(req: NextRequest) {
  const { amount } = await req.json();

  if (!amount || amount < 100) {
    return NextResponse.json({ error: 'Minimum deposit is $1.00' }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'Tavola Deposit' },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?deposit=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/deposit`,
  });

  return NextResponse.json({ url: session.url });
}
