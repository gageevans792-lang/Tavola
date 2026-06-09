'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPasswordError(null);
    setConfirmError(null);

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      console.error('[signup] error', signUpError.message);
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white text-[#0A1628] flex flex-col">
        <div className="px-12 lg:px-20 h-14 flex items-center border-b border-[#E2E8F0] shrink-0">
          <Link href="/" className="font-serif text-[13px] tracking-[0.4em] uppercase text-[#0A1628]">
            Tavola
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-[400px]">
            <div className="mb-12">
              <h1 className="font-serif text-[36px] font-light text-[#0A1628] leading-tight mb-3">
                Check your email
              </h1>
              <p className="text-[14px] text-[#0A1628]/60 leading-relaxed">
                Check your email to confirm your account. Once confirmed, you can sign in.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-block text-[11px] tracking-[0.2em] uppercase text-[#0A1628] hover:underline underline-offset-2"
            >
              Back to Sign In →
            </Link>
          </div>
        </div>

        <div className="px-6 pb-8 text-center shrink-0">
          <p className="text-[10px] text-[#0A1628]/30 leading-relaxed max-w-sm mx-auto">
            By creating an account you agree to our{' '}
            <Link href="#" className="hover:text-[#0A1628]/50 transition-colors">Terms of Service</Link>{' '}
            and{' '}
            <Link href="#" className="hover:text-[#0A1628]/50 transition-colors">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    );
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

          <div className="mb-12">
            <h1 className="font-serif text-[36px] font-light text-[#0A1628] leading-tight mb-3">
              Open your account
            </h1>
            <p className="text-[14px] text-[#0A1628]/50 leading-relaxed">
              Institutional-grade AI investing, available to everyone.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border-b border-[#E2E8F0] py-3 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors placeholder:text-[#0A1628]/20"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-b border-[#E2E8F0] py-3 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors placeholder:text-[#0A1628]/20"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                className="w-full border-b border-[#E2E8F0] py-3 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors placeholder:text-[#0A1628]/20"
                placeholder="Min. 8 characters"
              />
              {passwordError && (
                <p className="text-sm text-[#991b1b] mt-1">{passwordError}</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] tracking-[0.12em] uppercase text-[#0A1628]/40 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(null); }}
                className="w-full border-b border-[#E2E8F0] py-3 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors placeholder:text-[#0A1628]/20"
                placeholder="••••••••"
              />
              {confirmError && (
                <p className="text-sm text-[#991b1b] mt-1">{confirmError}</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-[#991b1b] mt-1">{error}</p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-12 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </div>
          </form>

          <p className="mt-8 text-[12px] text-[#0A1628]/50">
            Already have an account?{' '}
            <Link href="/login" className="text-[#0A1628] hover:underline underline-offset-2">
              Sign in →
            </Link>
          </p>

        </div>
      </div>

      <div className="px-6 pb-8 text-center shrink-0">
        <p className="text-[10px] text-[#0A1628]/30 leading-relaxed max-w-sm mx-auto">
          By creating an account you agree to our{' '}
          <Link href="#" className="hover:text-[#0A1628]/50 transition-colors">Terms of Service</Link>{' '}
          and{' '}
          <Link href="#" className="hover:text-[#0A1628]/50 transition-colors">Privacy Policy</Link>.
        </p>
      </div>

    </div>
  );
}
