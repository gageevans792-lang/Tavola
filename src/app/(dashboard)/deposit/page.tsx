'use client';

import { useState, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { createClient } from '@/lib/supabase/client';
import type { RiskLevel } from '@/types';

const quickAmounts = [500, 1000, 5000, 10000, 25000];

const RISK_LABELS: Record<RiskLevel, string> = {
  conservative: 'Conservative',
  balanced:     'Balanced',
  growth:       'Growth',
  aggressive:   'Aggressive',
};

export default function DepositPage() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [betaMode, setBetaMode] = useState(false);
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('risk_profiles')
          .select('level')
          .eq('user_id', user.id)
          .single();
        if (data) setRiskLevel(data.level as RiskLevel);
      } catch {
        // non-fatal
      }
    }
    loadProfile();
  }, []);

  async function handleDeposit() {
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(value * 100) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBetaMode(true);
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setBetaMode(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="Deposit" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-4 sm:p-6">
        <div className="mx-auto max-w-md space-y-4">

          {betaMode && (
            <div className="bg-white border border-[#E2E8F0] px-6 py-5">
              <p className="text-sm font-medium text-[#0A1628] mb-1">Deposits coming soon.</p>
              <p className="text-sm text-[#4A5568]">Platform is in beta. Payment processing will be enabled at launch.</p>
            </div>
          )}

          {riskLevel && (
            <div className="bg-white border border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
              <span className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568]">Risk Profile</span>
              <span className="font-serif text-sm font-light text-[#B8960C]">{RISK_LABELS[riskLevel]}</span>
            </div>
          )}

          <div className="bg-white border border-[#E2E8F0] p-8">
            <h2 className="font-serif text-xl font-light text-[#0A1628] mb-1">Add funds</h2>
            <p className="text-sm text-[#4A5568] mb-8">Funds are available instantly after payment.</p>

            <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-3">
              Quick select
            </label>
            <div className="grid grid-cols-3 gap-2 mb-6 sm:grid-cols-5">
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
                  ${a >= 1000 ? `${a / 1000}k` : a}
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
                onChange={(e) => { setError(null); setAmount(e.target.value); }}
                placeholder="0.00"
                className="w-full border-b border-[#E2E8F0] py-3 pl-4 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors placeholder:text-[#0A1628]/20"
              />
            </div>

            {error && <p className="mb-4 text-xs text-[#C41E3A]">{error}</p>}

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
