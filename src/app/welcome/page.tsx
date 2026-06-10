'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const STEPS = [
  {
    number: '01',
    label: 'We learn your goals',
    done: true,
  },
  {
    number: '02',
    label: 'AutoPilot manages your portfolio',
    done: false,
  },
  {
    number: '03',
    label: 'You watch it grow',
    done: false,
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const name = user?.user_metadata?.full_name as string | undefined;
      if (name) setFirstName(name.split(' ')[0]);
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">

      {/* Logo */}
      <p className="font-serif text-[12px] tracking-[0.4em] uppercase text-[#0A1628]/40 mb-16">
        Tavola
      </p>

      {/* Greeting */}
      <p className="text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-5">
        You're all set
      </p>
      <h1 className="font-serif text-[36px] sm:text-[48px] lg:text-[56px] font-light text-[#0A1628] leading-tight mb-4">
        {firstName ? `Welcome, ${firstName}.` : 'Welcome.'}
      </h1>
      <p className="text-[16px] text-[#4A5568] mb-16 max-w-sm leading-relaxed">
        Tavola works in three steps.
      </p>

      {/* Three steps */}
      <div className="w-full max-w-sm space-y-0 mb-16 border border-[#E2E8F0]">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className="flex items-center gap-5 px-6 py-5 border-b border-[#E2E8F0] last:border-b-0"
          >
            <span className="font-serif text-[28px] font-light leading-none text-[#B8960C] opacity-30 shrink-0 w-8">
              {step.number}
            </span>
            <div className="text-left min-w-0">
              <p className="text-[14px] text-[#0A1628] leading-snug">{step.label}</p>
            </div>
            {step.done && (
              <span className="ml-auto shrink-0 text-[10px] tracking-[0.15em] uppercase text-[#166534] border border-[#166534]/30 bg-[#166534]/5 px-2 py-0.5">
                Done
              </span>
            )}
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => router.push('/dashboard')}
        className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase px-12 py-4 hover:bg-[#162035] transition-colors"
      >
        See My Portfolio
      </button>

      <p className="mt-6 text-[11px] text-[#4A5568]/50">
        Paper trading beta. No real money at risk.
      </p>

    </div>
  );
}
