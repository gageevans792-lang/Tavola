'use client';

import { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';

const quickAmounts = [500, 1000, 2500, 5000];

export default function DepositPage() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(value * 100) }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Deposit" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-6">
        <div className="mx-auto max-w-md">

          <div className="bg-white border border-[#E2E8F0] p-8">
            <h2 className="font-serif text-xl font-light text-[#0A1628] mb-1">Add funds</h2>
            <p className="text-sm text-[#4A5568] mb-8">Funds are available instantly after payment.</p>

            <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-3">
              Quick select
            </label>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {quickAmounts.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(String(a))}
                  className={`border py-3 text-sm transition-colors ${
                    amount === String(a)
                      ? 'border-[#0A1628] bg-[#F8F9FA] text-[#0A1628] font-medium'
                      : 'border-[#E2E8F0] text-[#4A5568] hover:border-[#0A1628]/40'
                  }`}
                >
                  ${a.toLocaleString()}
                </button>
              ))}
            </div>

            <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-1">
              Custom amount
            </label>
            <div className="relative mb-8">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[#4A5568] text-sm">$</span>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border-b border-[#E2E8F0] py-3 pl-4 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors placeholder:text-[#0A1628]/20"
              />
            </div>

            <button
              onClick={handleDeposit}
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className="w-full bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-12 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Redirecting...'
                : `Deposit${amount && parseFloat(amount) > 0 ? ` $${parseFloat(amount).toLocaleString()}` : ''}`}
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
