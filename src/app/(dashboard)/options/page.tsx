'use client';

import { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';

const FEATURE_CARDS = [
  {
    title:       'Covered Calls',
    description: 'Generate consistent income on your existing equity positions by selling call options above the current price.',
    badge:       'Income Strategy',
    badgeColor:  'text-[#166534] border-[#166534]/30',
  },
  {
    title:       'Protective Puts',
    description: 'Hedge your downside risk with put options that protect the value of your portfolio during market drawdowns.',
    badge:       'Hedge Strategy',
    badgeColor:  'text-[#991b1b] border-[#991b1b]/30',
  },
  {
    title:       'AI Options Strategies',
    description: 'Claude identifies optimal strike prices and expiry dates based on your portfolio composition, market regime, and volatility.',
    badge:       'AI-Powered',
    badgeColor:  'text-[#B8960C] border-[#B8960C]/30',
  },
  {
    title:       'Earnings Plays',
    description: 'Position before earnings announcements using AI-analyzed historical patterns, implied volatility, and analyst consensus.',
    badge:       'Event-Driven',
    badgeColor:  'text-[#4A5568] border-[#4A5568]/30',
  },
];

export default function OptionsPage() {
  const [email, setEmail]   = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [msg,    setMsg]    = useState('');

  async function handleJoin() {
    if (!email.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), type: 'options' }),
      });
      if (res.ok) {
        setStatus('success');
        setMsg("You're on the early access list. We'll reach out when Options launches.");
        setEmail('');
      } else {
        setStatus('error');
        setMsg('Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMsg('Something went wrong. Please try again.');
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Options" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
        <div className="mx-auto max-w-5xl px-4 sm:px-8 py-12 sm:py-20">

          {/* Header */}
          <div className="text-center mb-14">
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#B8960C] mb-4">Coming Soon</p>
            <h1 className="font-serif text-[32px] sm:text-[48px] font-light text-[#0A1628] mb-4 leading-tight">
              Options Trading
            </h1>
            <p className="text-[15px] sm:text-[17px] text-[#4A5568] max-w-xl mx-auto leading-relaxed">
              Covered calls, protective puts, and AI-generated options strategies — built for intelligent investors.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#E2E8F0] mb-14">
            {FEATURE_CARDS.map((card) => (
              <div key={card.title} className="bg-white px-6 sm:px-8 py-7 border-l-2 border-[#B8960C]">
                <div className={`inline-block border px-2 py-0.5 text-[9px] tracking-[0.15em] uppercase font-medium mb-4 ${card.badgeColor}`}>
                  {card.badge}
                </div>
                <h3 className="font-serif text-[18px] font-light text-[#0A1628] mb-2">{card.title}</h3>
                <p className="text-[13px] text-[#4A5568] leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>

          {/* Waitlist */}
          <div className="bg-white border border-[#E2E8F0] px-6 sm:px-12 py-10 text-center max-w-lg mx-auto">
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#B8960C] mb-4">Early Access</p>
            <h2 className="font-serif text-[22px] font-light text-[#0A1628] mb-2">
              Join the waitlist
            </h2>
            <p className="text-sm text-[#4A5568] mb-7 leading-relaxed">
              Be first in line when Options Trading launches. Early access members receive priority onboarding and fee discounts.
            </p>

            {status === 'success' ? (
              <div className="border-l-2 border-[#166534] pl-4 text-left">
                <p className="text-[13px] text-[#166534]">{msg}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  placeholder="your@email.com"
                  className="w-full border-b border-[#E2E8F0] py-2 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent placeholder:text-[#0A1628]/25 text-center transition-colors"
                />
                <button
                  onClick={handleJoin}
                  disabled={status === 'loading' || !email.trim()}
                  className="w-full py-3 bg-[#0A1628] text-white text-[11px] tracking-[0.25em] uppercase hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? 'Joining...' : 'Join Waitlist for Early Access'}
                </button>
                {status === 'error' && (
                  <p className="text-[12px] text-[#991b1b]">{msg}</p>
                )}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
