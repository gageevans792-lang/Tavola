'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import type { RiskLevel } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type GoalId    = 'wealth_building' | 'retirement' | 'passive_income' | 'short_term_growth';
type HorizonId = '1_2' | '3_5' | '5_10' | '10_plus';
type NetWorthId = 'under_50k' | '50k_250k' | '250k_1m' | '1m_plus';

interface QuizAnswers {
  q1: 'sell' | 'hold' | 'buy' | '';
  q2: 'protect' | 'balanced' | 'maximum' | '';
  q3: 'beginner' | 'some' | 'experienced' | '';
}

// ── Static data ───────────────────────────────────────────────────────────────

const GOALS: { id: GoalId; label: string; desc: string }[] = [
  { id: 'wealth_building',   label: 'Wealth Building',    desc: 'Compound capital over the long term'       },
  { id: 'retirement',        label: 'Retirement',         desc: 'Build toward financial independence'       },
  { id: 'passive_income',    label: 'Passive Income',     desc: 'Generate consistent cash distributions'   },
  { id: 'short_term_growth', label: 'Short-Term Growth',  desc: 'Capture near-term market opportunities'   },
];

const HORIZONS: { id: HorizonId; label: string; desc: string }[] = [
  { id: '1_2',      label: '1–2 Years',  desc: 'Liquidity within reach'   },
  { id: '3_5',      label: '3–5 Years',  desc: 'Medium-term objective'    },
  { id: '5_10',     label: '5–10 Years', desc: 'Sustained growth window'  },
  { id: '10_plus',  label: '10+ Years',  desc: 'Generational horizon'     },
];

const NET_WORTH: { id: NetWorthId; label: string }[] = [
  { id: 'under_50k',  label: 'Under $50k'       },
  { id: '50k_250k',   label: '$50k – $250k'     },
  { id: '250k_1m',    label: '$250k – $1M'      },
  { id: '1m_plus',    label: '$1M+'             },
];

const DEPOSIT_PRESETS  = [500, 1_000, 5_000, 10_000, 25_000];
const CONTRIB_PRESETS  = [0, 100, 250, 500];

const RISK_CONFIG: Record<RiskLevel, {
  label:      string;
  accent:     string;
  returnLow:  number;
  returnHigh: number;
  returnMid:  number;
  tagline:    string;
}> = {
  conservative: {
    label: 'Conservative', accent: '#22C55E',
    returnLow: 0.04, returnHigh: 0.06, returnMid: 0.05,
    tagline: 'Capital preservation with steady, predictable growth.',
  },
  balanced: {
    label: 'Balanced', accent: '#3B82F6',
    returnLow: 0.06, returnHigh: 0.08, returnMid: 0.07,
    tagline: 'Moderate growth across diversified asset classes.',
  },
  growth: {
    label: 'Growth', accent: '#B8960C',
    returnLow: 0.08, returnHigh: 0.10, returnMid: 0.09,
    tagline: 'Higher return potential with quality growth equities.',
  },
  aggressive: {
    label: 'Aggressive', accent: '#EF4444',
    returnLow: 0.10, returnHigh: 0.13, returnMid: 0.115,
    tagline: 'Maximum return potential with full market exposure.',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcRisk(q: QuizAnswers): RiskLevel {
  const s1 = q.q1 === 'sell' ? -2 : q.q1 === 'buy' ? 2 : 0;
  const s2 = q.q2 === 'protect' ? -2 : q.q2 === 'maximum' ? 2 : 0;
  const s3 = q.q3 === 'beginner' ? -1 : q.q3 === 'experienced' ? 1 : 0;
  const total = s1 + s2 + s3;
  if (total <= -2) return 'conservative';
  if (total <= 1)  return 'balanced';
  if (total <= 3)  return 'growth';
  return 'aggressive';
}

function projectFV(initial: number, monthly: number, annualRate: number, years: number): number {
  if (annualRate === 0) return initial + monthly * 12 * years;
  const r = annualRate / 12;
  const n = years * 12;
  const fvLump    = initial * Math.pow(1 + r, n);
  const fvAnnuity = monthly > 0 ? monthly * (Math.pow(1 + r, n) - 1) / r : 0;
  return fvLump + fvAnnuity;
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function horizonLabel(id: HorizonId | null): string {
  if (!id) return '5-10';
  return id.replace('_', '-').replace('plus', '+');
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  // meta
  const [step, setStep]           = useState(1);
  const [firstName, setFirstName] = useState('');

  // step 1
  const [goals, setGoals]         = useState<GoalId[]>([]);

  // step 2
  const [horizon, setHorizon]     = useState<HorizonId | null>(null);

  // step 3
  const [quiz, setQuiz]           = useState<QuizAnswers>({ q1: '', q2: '', q3: '' });

  // step 4
  const [deposit, setDeposit]           = useState<number | null>(null);
  const [customDeposit, setCustomDeposit] = useState('');
  const [monthly, setMonthly]           = useState<number>(0);
  const [customMonthly, setCustomMonthly] = useState('');
  const [netWorth, setNetWorth]         = useState<NetWorthId | null>(null);

  // step 5
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [showReady, setShowReady] = useState(false);

  const riskLevel  = calcRisk(quiz);
  const rc         = RISK_CONFIG[riskLevel];
  const depositAmt = deposit ?? 0;

  // ── Load user name ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const name = user.user_metadata?.full_name as string | undefined;
      if (name) setFirstName(name.split(' ')[0]);
    }
    load();
  }, [router]);

  // ── AI plan fetch ──────────────────────────────────────────────────────────

  const fetchPlan = useCallback(async () => {
    setAiLoading(true);
    setAiSummary('');
    try {
      const res = await fetch('/api/ai/onboarding-plan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          risk_level:     riskLevel,
          goals:          goals.map((g) => g.replace(/_/g, ' ')),
          time_horizon:   horizonLabel(horizon),
          initial_deposit: depositAmt,
          monthly_contrib: monthly,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { summary: string };
        setAiSummary(data.summary ?? '');
      }
    } catch {
      // non-critical
    } finally {
      setAiLoading(false);
    }
  }, [riskLevel, goals, horizon, depositAmt, monthly]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  function advance(n: number) {
    setStep(n);
    if (n === 5) fetchPlan();
    window.scrollTo({ top: 0 });
  }

  // ── Save & finish ──────────────────────────────────────────────────────────

  async function handleFinish() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('risk_profiles').upsert(
        {
          user_id:            user.id,
          level:              riskLevel,
          investment_goals:   goals,
          time_horizon:       horizon,
          risk_quiz_answers:  quiz,
          initial_deposit:    depositAmt || null,
          monthly_contrib:    monthly || null,
          net_worth_range:    netWorth,
          onboarding_done:    true,
        },
        { onConflict: 'user_id' },
      );

      setShowReady(true);
    } catch {
      router.push('/dashboard');
    } finally {
      setSaving(false);
    }
  }

  // ── Derived state for step 3 ───────────────────────────────────────────────

  const quizComplete = quiz.q1 !== '' && quiz.q2 !== '' && quiz.q3 !== '';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white text-[#0A1628] flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="h-14 flex items-center justify-between px-8 border-b border-[#E2E8F0] shrink-0">
        <Link href="/" className="font-serif text-[13px] tracking-[0.4em] uppercase text-[#0A1628]">
          Tavola
        </Link>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-[11px] tracking-[0.1em] uppercase text-[#0A1628]/40 hover:text-[#0A1628] transition-colors"
        >
          Skip
        </button>
      </header>

      {/* ── Progress bar ────────────────────────────────────────────────────── */}
      <div className="flex">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className="h-[2px] flex-1 transition-all duration-500"
            style={{ background: s <= step ? '#B8960C' : '#E2E8F0' }}
          />
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex justify-center px-6 py-12">

        {/* ── READY SCREEN ────────────────────────────────────────────────────── */}
        {showReady ? (
          <div className="w-full max-w-[640px] py-8">
            <div className="w-12 h-12 bg-[#B8960C] flex items-center justify-center mb-8">
              <span className="text-white text-xl">✓</span>
            </div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#B8960C] mb-4">Account Ready</p>
            <h1 className="font-serif text-[40px] font-light text-[#0A1628] leading-tight mb-6">
              Your Tavola account<br />is ready.
            </h1>

            {/* Risk profile summary */}
            <div
              className="border-l-[3px] px-6 py-5 mb-6"
              style={{ borderColor: rc.accent, background: '#F8F9FA' }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">Your Risk Profile</p>
                <span
                  className="text-[10px] tracking-[0.12em] uppercase px-2.5 py-1 font-medium text-white"
                  style={{ background: rc.accent }}
                >
                  {rc.label}
                </span>
              </div>
              <p className="font-serif text-[22px] font-light text-[#0A1628]">{rc.tagline}</p>
            </div>

            {/* Expected return range */}
            <div className="border border-[#E2E8F0] px-6 py-4 mb-8">
              <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568] mb-1">Expected Annual Return</p>
              <p className="font-mono text-[28px] font-medium text-[#0A1628] tabular-nums">
                {(rc.returnLow * 100).toFixed(0)}–{(rc.returnHigh * 100).toFixed(0)}%
              </p>
              <p className="text-[12px] text-[#4A5568] mt-1">Based on historical backtests at your risk level</p>
            </div>

            {/* CTAs */}
            <a
              href="/deposit"
              className="block w-full bg-[#B8960C] text-white text-[11px] tracking-[0.2em] uppercase h-12 flex items-center justify-center hover:bg-[#9a7d0a] transition-colors mb-3"
            >
              Fund Your Account
            </a>
            <a
              href="/dashboard"
              className="block w-full text-center text-[12px] text-[#0A1628]/40 hover:text-[#0A1628] transition-colors py-3"
            >
              Explore Dashboard →
            </a>
          </div>
        ) : (
        <div className="w-full max-w-[640px]">

          <p className="text-[10px] tracking-[0.18em] uppercase text-[#0A1628]/35 mb-10">
            Step {step} of 5
          </p>

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 1: INVESTMENT GOALS
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div>
              <h1 className="font-serif text-[40px] font-light leading-tight text-[#0A1628] mb-2">
                {firstName ? `${firstName}, what are` : 'What are'} you<br />investing for?
              </h1>
              <p className="text-[14px] text-[#0A1628]/50 mb-10 leading-relaxed">
                Select all that apply. Your goals shape how Tavola&apos;s AI allocates your capital.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-10">
                {GOALS.map((g) => {
                  const selected = goals.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() =>
                        setGoals((prev) =>
                          selected ? prev.filter((x) => x !== g.id) : [...prev, g.id]
                        )
                      }
                      className={cn(
                        'border p-5 text-left transition-all',
                        selected
                          ? 'border-[#0A1628] bg-[#F8F9FA]'
                          : 'border-[#E2E8F0] hover:border-[#0A1628]/40'
                      )}
                    >
                      {selected && (
                        <div className="h-1.5 w-1.5 rounded-full bg-[#B8960C] mb-3" />
                      )}
                      {!selected && <div className="h-1.5 w-1.5 mb-3" />}
                      <p className="font-serif text-[18px] font-light text-[#0A1628] leading-tight">
                        {g.label}
                      </p>
                      <p className="mt-1 text-[12px] text-[#4A5568] leading-snug">{g.desc}</p>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => advance(2)}
                disabled={goals.length === 0}
                className="w-full bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase h-12 hover:bg-[#162035] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 2: TIME HORIZON
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div>
              <h1 className="font-serif text-[40px] font-light leading-tight text-[#0A1628] mb-2">
                When will you need<br />this money?
              </h1>
              <p className="text-[14px] text-[#0A1628]/50 mb-10 leading-relaxed">
                Your time horizon determines how aggressively Tavola can invest on your behalf.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-10">
                {HORIZONS.map((h) => {
                  const selected = horizon === h.id;
                  return (
                    <button
                      key={h.id}
                      onClick={() => setHorizon(h.id)}
                      className={cn(
                        'border p-6 text-left transition-all',
                        selected
                          ? 'border-[#0A1628] bg-[#F8F9FA]'
                          : 'border-[#E2E8F0] hover:border-[#0A1628]/40'
                      )}
                    >
                      <p
                        className="font-serif leading-none mb-2"
                        style={{
                          fontSize: '28px',
                          fontWeight: 300,
                          color: selected ? '#0A1628' : '#0A1628',
                        }}
                      >
                        {h.label}
                      </p>
                      <p className="text-[12px] text-[#4A5568]">{h.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="border border-[#E2E8F0] text-[#0A1628] text-[11px] tracking-[0.2em] uppercase h-12 px-8 hover:border-[#0A1628] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => advance(3)}
                  disabled={!horizon}
                  className="flex-1 bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase h-12 hover:bg-[#162035] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 3: RISK TOLERANCE QUIZ
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div>
              <h1 className="font-serif text-[40px] font-light leading-tight text-[#0A1628] mb-2">
                Risk tolerance
              </h1>
              <p className="text-[14px] text-[#0A1628]/50 mb-10 leading-relaxed">
                Three questions to calibrate your AI strategy. There are no wrong answers.
              </p>

              {/* Q1 */}
              <div className="mb-8">
                <p className="text-[11px] tracking-[0.12em] uppercase text-[#B8960C] mb-3">
                  Question 1
                </p>
                <p className="text-[16px] font-medium text-[#0A1628] mb-4">
                  If your portfolio dropped 20% tomorrow, you would:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'sell',  label: 'Sell everything',       sub: 'Protect capital'        },
                    { value: 'hold',  label: 'Hold steady',           sub: 'Trust the process'      },
                    { value: 'buy',   label: 'Buy more',              sub: 'Opportunistic entry'    },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setQuiz((q) => ({ ...q, q1: opt.value }))}
                      className={cn(
                        'border p-4 text-left transition-all',
                        quiz.q1 === opt.value
                          ? 'border-[#0A1628] bg-[#F8F9FA]'
                          : 'border-[#E2E8F0] hover:border-[#0A1628]/40'
                      )}
                    >
                      <p className="text-[13px] font-medium text-[#0A1628] leading-snug">{opt.label}</p>
                      <p className="text-[11px] text-[#4A5568] mt-1">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q2 */}
              <div className="mb-8">
                <p className="text-[11px] tracking-[0.12em] uppercase text-[#B8960C] mb-3">
                  Question 2
                </p>
                <p className="text-[16px] font-medium text-[#0A1628] mb-4">
                  Your primary investment priority is:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'protect',  label: 'Protecting capital',  sub: 'Minimize downside'     },
                    { value: 'balanced', label: 'Balanced growth',     sub: 'Risk-adjusted returns' },
                    { value: 'maximum',  label: 'Maximum returns',     sub: 'Accept volatility'     },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setQuiz((q) => ({ ...q, q2: opt.value }))}
                      className={cn(
                        'border p-4 text-left transition-all',
                        quiz.q2 === opt.value
                          ? 'border-[#0A1628] bg-[#F8F9FA]'
                          : 'border-[#E2E8F0] hover:border-[#0A1628]/40'
                      )}
                    >
                      <p className="text-[13px] font-medium text-[#0A1628] leading-snug">{opt.label}</p>
                      <p className="text-[11px] text-[#4A5568] mt-1">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q3 */}
              <div className="mb-10">
                <p className="text-[11px] tracking-[0.12em] uppercase text-[#B8960C] mb-3">
                  Question 3
                </p>
                <p className="text-[16px] font-medium text-[#0A1628] mb-4">
                  Your investment experience level:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'beginner',    label: 'First time',    sub: 'New to investing'    },
                    { value: 'some',        label: 'Some experience', sub: 'Familiar with markets' },
                    { value: 'experienced', label: 'Experienced',   sub: 'Confident investor'  },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setQuiz((q) => ({ ...q, q3: opt.value }))}
                      className={cn(
                        'border p-4 text-left transition-all',
                        quiz.q3 === opt.value
                          ? 'border-[#0A1628] bg-[#F8F9FA]'
                          : 'border-[#E2E8F0] hover:border-[#0A1628]/40'
                      )}
                    >
                      <p className="text-[13px] font-medium text-[#0A1628] leading-snug">{opt.label}</p>
                      <p className="text-[11px] text-[#4A5568] mt-1">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk preview */}
              {quizComplete && (
                <div
                  className="border-l-2 px-5 py-4 mb-8 bg-[#F8F9FA]"
                  style={{ borderColor: rc.accent }}
                >
                  <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568] mb-1">
                    Your calculated profile
                  </p>
                  <p className="font-serif text-[22px] font-light" style={{ color: rc.accent }}>
                    {rc.label}
                  </p>
                  <p className="text-[12px] text-[#4A5568] mt-1">{rc.tagline}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="border border-[#E2E8F0] text-[#0A1628] text-[11px] tracking-[0.2em] uppercase h-12 px-8 hover:border-[#0A1628] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => advance(4)}
                  disabled={!quizComplete}
                  className="flex-1 bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase h-12 hover:bg-[#162035] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 4: FINANCIAL PICTURE
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div>
              <h1 className="font-serif text-[40px] font-light leading-tight text-[#0A1628] mb-2">
                Your financial<br />picture
              </h1>
              <p className="text-[14px] text-[#0A1628]/50 mb-10 leading-relaxed">
                Help Tavola project your growth and personalize your strategy. All fields are optional.
              </p>

              {/* Initial deposit */}
              <div className="mb-8">
                <p className="text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/60 mb-4">
                  Initial deposit amount
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {DEPOSIT_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => { setDeposit(amt); setCustomDeposit(''); }}
                      className={cn(
                        'border px-4 h-9 text-[12px] font-mono transition-all',
                        deposit === amt && customDeposit === ''
                          ? 'border-[#0A1628] bg-[#0A1628] text-white'
                          : 'border-[#E2E8F0] text-[#0A1628] hover:border-[#0A1628]/40'
                      )}
                    >
                      ${amt.toLocaleString()}
                    </button>
                  ))}
                  <button
                    onClick={() => { setDeposit(null); setCustomDeposit(''); }}
                    className={cn(
                      'border px-4 h-9 text-[12px] transition-all',
                      deposit === null
                        ? 'border-[#0A1628] bg-[#0A1628] text-white'
                        : 'border-[#E2E8F0] text-[#0A1628] hover:border-[#0A1628]/40'
                    )}
                  >
                    Custom
                  </button>
                </div>
                {deposit === null && (
                  <div className="flex items-center border border-[#E2E8F0] focus-within:border-[#0A1628] transition-colors">
                    <span className="px-4 text-[13px] text-[#0A1628]/50">$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Enter amount"
                      value={customDeposit}
                      onChange={(e) => {
                        setCustomDeposit(e.target.value);
                        const n = parseFloat(e.target.value);
                        setDeposit(isNaN(n) ? null : n);
                      }}
                      className="flex-1 h-11 pr-4 text-[13px] text-[#0A1628] bg-transparent outline-none placeholder:text-[#0A1628]/30"
                    />
                  </div>
                )}
              </div>

              {/* Monthly contribution */}
              <div className="mb-8">
                <p className="text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/60 mb-4">
                  Monthly contribution <span className="normal-case tracking-normal text-[#0A1628]/35">(optional)</span>
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {CONTRIB_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => { setMonthly(amt); setCustomMonthly(''); }}
                      className={cn(
                        'border px-4 h-9 text-[12px] font-mono transition-all',
                        monthly === amt && customMonthly === ''
                          ? 'border-[#0A1628] bg-[#0A1628] text-white'
                          : 'border-[#E2E8F0] text-[#0A1628] hover:border-[#0A1628]/40'
                      )}
                    >
                      {amt === 0 ? '$0' : `$${amt}/mo`}
                    </button>
                  ))}
                  <button
                    onClick={() => setCustomMonthly('custom')}
                    className={cn(
                      'border px-4 h-9 text-[12px] transition-all',
                      customMonthly === 'custom'
                        ? 'border-[#0A1628] bg-[#0A1628] text-white'
                        : 'border-[#E2E8F0] text-[#0A1628] hover:border-[#0A1628]/40'
                    )}
                  >
                    Custom
                  </button>
                </div>
                {customMonthly === 'custom' && (
                  <div className="flex items-center border border-[#E2E8F0] focus-within:border-[#0A1628] transition-colors">
                    <span className="px-4 text-[13px] text-[#0A1628]/50">$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="Amount per month"
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        setMonthly(isNaN(n) ? 0 : n);
                      }}
                      className="flex-1 h-11 pr-4 text-[13px] text-[#0A1628] bg-transparent outline-none placeholder:text-[#0A1628]/30"
                    />
                  </div>
                )}
              </div>

              {/* Net worth */}
              <div className="mb-10">
                <p className="text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/60 mb-4">
                  Current net worth <span className="normal-case tracking-normal text-[#0A1628]/35">(optional)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {NET_WORTH.map((nw) => (
                    <button
                      key={nw.id}
                      onClick={() => setNetWorth((prev) => prev === nw.id ? null : nw.id)}
                      className={cn(
                        'border px-4 h-10 text-[12px] text-left transition-all',
                        netWorth === nw.id
                          ? 'border-[#0A1628] bg-[#0A1628] text-white'
                          : 'border-[#E2E8F0] text-[#0A1628] hover:border-[#0A1628]/40'
                      )}
                    >
                      {nw.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="border border-[#E2E8F0] text-[#0A1628] text-[11px] tracking-[0.2em] uppercase h-12 px-8 hover:border-[#0A1628] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => advance(5)}
                  className="flex-1 bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase h-12 hover:bg-[#162035] transition-colors"
                >
                  Build My Plan
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 5: YOUR TAVOLA PLAN
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 5 && (
            <div>
              <p className="text-[11px] tracking-[0.2em] uppercase text-[#B8960C] mb-3">
                Your Tavola Plan
              </p>
              <h1 className="font-serif text-[40px] font-light leading-tight text-[#0A1628] mb-10">
                {firstName ? `${firstName}'s` : 'Your'} personalized<br />investment strategy
              </h1>

              {/* Risk profile card */}
              <div
                className="border-l-[3px] px-6 py-5 mb-6"
                style={{ borderColor: rc.accent, background: '#F8F9FA' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568]">
                    Risk Profile
                  </p>
                  <span
                    className="text-[10px] tracking-[0.12em] uppercase px-2.5 py-1 font-medium"
                    style={{ background: rc.accent, color: '#fff' }}
                  >
                    {rc.label}
                  </span>
                </div>
                <p className="font-serif text-[26px] font-light text-[#0A1628] leading-tight">
                  {rc.returnLow * 100}–{rc.returnHigh * 100}%
                  <span className="font-sans text-[13px] text-[#4A5568] ml-2 font-normal">
                    expected annual return
                  </span>
                </p>
              </div>

              {/* AI summary */}
              <div className="border border-[#E2E8F0] px-6 py-5 mb-6 min-h-[80px]">
                <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568] mb-3">
                  AI Strategy Analysis
                </p>
                {aiLoading ? (
                  <div className="space-y-2">
                    <div className="h-3.5 w-full animate-pulse bg-[#E2E8F0]" />
                    <div className="h-3.5 w-5/6 animate-pulse bg-[#E2E8F0]" />
                    <div className="h-3.5 w-4/6 animate-pulse bg-[#E2E8F0]" />
                  </div>
                ) : (
                  <p className="text-[14px] text-[#0A1628] leading-relaxed">
                    {aiSummary || rc.tagline}
                  </p>
                )}
              </div>

              {/* Projections */}
              {depositAmt > 0 && (
                <div className="border border-[#E2E8F0] mb-6">
                  <div className="px-6 py-4 border-b border-[#E2E8F0]">
                    <p className="text-[10px] tracking-[0.15em] uppercase text-[#4A5568]">
                      Growth Projection
                    </p>
                    <p className="text-[12px] text-[#0A1628]/50 mt-0.5">
                      ${depositAmt.toLocaleString()} initial
                      {monthly > 0 ? ` + $${monthly}/mo` : ''}
                      {' '}at {(rc.returnMid * 100).toFixed(0)}% avg. annual return
                    </p>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-[#E2E8F0]">
                    {[1, 5, 10].map((years) => {
                      const val = projectFV(depositAmt, monthly, rc.returnMid, years);
                      const gain = val - depositAmt - monthly * 12 * years;
                      const gainPct = ((val - depositAmt) / depositAmt) * 100;
                      return (
                        <div key={years} className="px-5 py-5">
                          <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568] mb-2">
                            {years} {years === 1 ? 'Year' : 'Years'}
                          </p>
                          <p className="font-mono text-[20px] font-medium text-[#0A1628] tabular-nums leading-tight">
                            {fmtMoney(val)}
                          </p>
                          {gain > 0 && (
                            <p className="text-[11px] text-[#166534] tabular-nums mt-1">
                              +{fmtMoney(gain)} ({gainPct.toFixed(0)}%)
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Goals summary */}
              <div className="border border-[#E2E8F0] px-6 py-4 mb-10">
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  <div>
                    <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">Goals</p>
                    <p className="text-[13px] text-[#0A1628] mt-0.5 capitalize">
                      {goals.map((g) => g.replace(/_/g, ' ')).join(', ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">Horizon</p>
                    <p className="text-[13px] text-[#0A1628] mt-0.5">
                      {HORIZONS.find((h) => h.id === horizon)?.label ?? '–'}
                    </p>
                  </div>
                  {netWorth && (
                    <div>
                      <p className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]">Net Worth</p>
                      <p className="text-[13px] text-[#0A1628] mt-0.5">
                        {NET_WORTH.find((n) => n.id === netWorth)?.label}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* CTAs */}
              <button
                onClick={handleFinish}
                disabled={saving}
                className="w-full bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase h-13 py-3.5 hover:bg-[#162035] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
              >
                {saving ? 'Saving your plan...' : 'Start Investing'}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full text-center text-[12px] text-[#0A1628]/40 hover:text-[#0A1628] transition-colors py-2"
              >
                Skip to dashboard
              </button>
            </div>
          )}

        </div>
        )}
      </div>
    </div>
  );
}
