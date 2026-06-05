'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const riskOptions = [
  { value: 'conservative', label: 'Conservative', description: 'Prioritize capital preservation' },
  { value: 'moderate', label: 'Moderate', description: 'Balance growth and stability' },
  { value: 'aggressive', label: 'Aggressive', description: 'Maximize long-term growth' },
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-2 flex gap-1">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={cn('h-1 flex-1 rounded-full', s <= step ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700')}
            />
          ))}
        </div>
        <p className="mb-8 text-xs text-gray-500">Step {step} of 2</p>

        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">What&apos;s your risk tolerance?</h2>
            <p className="mt-2 text-sm text-gray-500">This helps us tailor AI recommendations to your style.</p>
            <div className="mt-6 space-y-3">
              {riskOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRisk(opt.value)}
                  className={cn(
                    'w-full rounded-xl border-2 p-4 text-left transition-colors',
                    risk === opt.value
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                  )}
                >
                  <p className="font-semibold text-gray-900 dark:text-white">{opt.label}</p>
                  <p className="text-sm text-gray-500">{opt.description}</p>
                </button>
              ))}
            </div>
            <Button className="mt-6 w-full" onClick={() => setStep(2)}>Continue</Button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">What&apos;s your investment goal?</h2>
            <p className="mt-2 text-sm text-gray-500">Describe what you&apos;re saving or investing for.</p>
            <textarea
              className="mt-6 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              rows={4}
              placeholder="e.g. Retire at 50 with $2M portfolio..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={!goal.trim()}>
                Get started
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
