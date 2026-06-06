'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') ?? '/dashboard';
    router.push(next.startsWith('/') ? next : '/dashboard');
    router.refresh();
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
              Welcome back
            </h1>
            <p className="text-[14px] text-[#0A1628]/50 leading-relaxed">
              Sign in to your Tavola account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
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
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-b border-[#E2E8F0] py-3 text-sm text-[#0A1628] outline-none focus:border-[#0A1628] bg-transparent transition-colors placeholder:text-[#0A1628]/20"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[13px] text-red-600 leading-relaxed">{error}</p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A1628] text-white text-xs tracking-[0.2em] uppercase h-12 hover:bg-[#1a2f4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>

          <p className="mt-8 text-[12px] text-[#0A1628]/50">
            New to Tavola?{' '}
            <Link href="/signup" className="text-[#0A1628] hover:underline underline-offset-2">
              Open an account →
            </Link>
          </p>

        </div>
      </div>

      <div className="px-6 pb-8 text-center shrink-0">
        <p className="text-[10px] text-[#0A1628]/30 leading-relaxed">
          Paper trading platform for demonstration purposes only.
        </p>
      </div>

    </div>
  );
}
