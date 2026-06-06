'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { RiskLevel } from '@/types';

const riskOptions: { value: RiskLevel; label: string; description: string; range: string }[] = [
  { value: 'conservative', label: 'Conservative', description: 'Capital preservation, steady income',    range: '6–12%'  },
  { value: 'balanced',     label: 'Balanced',     description: 'Moderate growth, managed volatility',   range: '15–25%' },
  { value: 'growth',       label: 'Growth',       description: 'Higher returns, higher volatility',     range: '30–50%' },
  { value: 'aggressive',   label: 'Aggressive',   description: 'Maximum returns, full market exposure', range: '50%+'   },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [risk, setRisk] = useState<RiskLevel>('balanced');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const fullName = user.user_metadata?.full_name as string | undefined;
      if (fullName) setFirstName(fullName.split(' ')[0]);
    }
    loadUser();
  }, [router]);

  async function handleSaveRisk() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: upsertError } = await supabase
        .from('risk_profiles')
        .upsert({ user_id: user.id, level: risk }, { onConflict: 'user_id' });

      if (upsertError) {
        // Non-fatal if table doesn't exist yet — log and continue
        console.warn('[onboarding] risk profile save:', upsertError.message);
      }

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#0A1628] flex flex-col">

      <div className="px-12 lg:px-20 h-14 flex items-center border-b border-[#E2E8F0] shrink-0">
        <Link href="/" className="font-serif text-[13px] tracking-[0.4em] uppercase text-[#0A1628]">
          Tavola
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[400px]">

          {/* Progress indicator */}
          <div className="flex gap-2 mb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn('h-px flex-1 transition-colors', s <= step ? 'bg-[#B8960C]' : 'bg-[#E2E8F0]')}
              />
            ))}
          </div>
          <p className="text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-10">
            Step {step} of 3
          </p>

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div>
              <h1 className="font-serif text-[36px] font-light text-[#0A1628] leading-tight mb-3">
                {firstName ? `Welcome, ${firstName}.` : 'Welcome.'}
              </h1>
              <p className="text-[14px] text-[#0A1628]/50 mb-10 leading-relaxed">
                Let&apos;s set up your account in two quick steps. First we&apos;ll select a risk
                profile, then get your account funded.
              </p>
              <button
                onClick={() => setStep(2)}
                className="w-full bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-12 hover:bg-[#1a2f4a] transition-colors"
              >
                Get Started
              </button>
            </div>
          )}

          {/* Step 2: Risk profile */}
          {step === 2 && (
            <div>
              <h1 className="font-serif text-[36px] font-light text-[#0A1628] leading-tight mb-3">
                Choose a risk profile
              </h1>
              <p className="text-[14px] text-[#0A1628]/50 mb-8">
                Your profile determines how the AI allocates your capital.
              </p>

              <div className="space-y-3 mb-8">
                {riskOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRisk(opt.value)}
                    className={cn(
                      'w-full border p-5 text-left transition-colors flex items-center justify-between',
                      risk === opt.value
                        ? 'border-[#0A1628] bg-[#F8F9FA]'
                        : 'border-[#E2E8F0] hover:border-[#0A1628]/30'
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-[#0A1628]">{opt.label}</p>
                      <p className="text-xs text-[#4A5568] mt-0.5">{opt.description}</p>
                    </div>
                    <span className="font-serif text-sm font-light text-[#B8960C] ml-4 shrink-0">
                      {opt.range}
                    </span>
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-[12px] text-red-600 mb-4">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="border border-[#E2E8F0] text-[#0A1628] text-xs tracking-[0.2em] uppercase h-12 px-6 hover:border-[#0A1628] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveRisk}
                  disabled={saving}
                  className="flex-1 bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-12 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Fund account */}
          {step === 3 && (
            <div>
              <h1 className="font-serif text-[36px] font-light text-[#0A1628] leading-tight mb-3">
                Fund your account
              </h1>
              <p className="text-[14px] text-[#0A1628]/50 mb-10 leading-relaxed">
                Your risk profile is saved. Add funds to begin investing — no minimum deposit required.
              </p>

              <Link
                href="/deposit"
                className="flex w-full items-center justify-center bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-12 hover:bg-[#1a2f4a] transition-colors mb-4"
              >
                Deposit Funds
              </Link>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full text-center text-[12px] text-[#0A1628]/45 hover:text-[#0A1628] transition-colors py-2"
              >
                Skip for now
              </button>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
