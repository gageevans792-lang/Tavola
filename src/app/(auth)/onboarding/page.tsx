'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const riskOptions = [
  { value: 'conservative', label: 'Conservative', description: 'Prioritize capital preservation', range: '6–12%' },
  { value: 'moderate',     label: 'Moderate',     description: 'Balance growth and stability',   range: '15–25%' },
  { value: 'aggressive',   label: 'Aggressive',   description: 'Maximize long-term growth',      range: '30–50%' },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [risk, setRisk] = useState<string>('moderate');
  const [goal, setGoal] = useState('');

  const handleSubmit = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-white text-[#0A1628] flex flex-col">

      <div className="px-12 lg:px-20 h-14 flex items-center border-b border-[#E2E8F0] shrink-0">
        <Link href="/" className="font-serif text-[13px] tracking-[0.4em] uppercase text-[#0A1628]">
          Tavola
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[400px]">

          {/* Step indicator */}
          <div className="flex gap-2 mb-2">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={cn('h-px flex-1 transition-colors', s <= step ? 'bg-[#B8960C]' : 'bg-[#E2E8F0]')}
              />
            ))}
          </div>
          <p className="text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-10">
            Step {step} of 2
          </p>

          {step === 1 && (
            <div>
              <h1 className="font-serif text-[36px] font-light text-[#0A1628] leading-tight mb-3">
                What&apos;s your risk tolerance?
              </h1>
              <p className="text-[14px] text-[#0A1628]/50 mb-10">
                This helps us tailor AI recommendations to your style.
              </p>

              <div className="space-y-3 mb-10">
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

              <button
                onClick={() => setStep(2)}
                className="w-full bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-12 hover:bg-[#1a2f4a] transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="font-serif text-[36px] font-light text-[#0A1628] leading-tight mb-3">
                What&apos;s your investment goal?
              </h1>
              <p className="text-[14px] text-[#0A1628]/50 mb-10">
                Describe what you&apos;re saving or investing for.
              </p>

              <textarea
                className="w-full border border-[#E2E8F0] focus:border-[#0A1628] outline-none px-4 py-3 text-sm text-[#0A1628] bg-transparent transition-colors resize-none mb-8 placeholder:text-[#0A1628]/25"
                rows={4}
                placeholder="e.g. Retire at 50 with $2M portfolio..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="border border-[#E2E8F0] text-[#0A1628] text-xs tracking-[0.2em] uppercase h-12 px-6 hover:border-[#0A1628] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!goal.trim()}
                  className="flex-1 bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-12 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Get Started
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
