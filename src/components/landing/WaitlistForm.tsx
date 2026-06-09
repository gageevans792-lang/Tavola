'use client';
import { useState } from 'react';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="py-4">
        <p className="font-serif text-xl font-light text-[#0A1628] mb-1">You&apos;re on the list!</p>
        <p className="text-sm text-[#4A5568]">We&apos;ll notify you when early access opens.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          placeholder="Your email address"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
          className="flex-1 border border-[#E2E8F0] px-4 h-12 text-[13px] text-[#0A1628] outline-none focus:border-[#0A1628] transition-colors placeholder:text-[#0A1628]/40 bg-white"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-[#B8960C] text-white px-6 h-12 text-[11px] tracking-[0.2em] uppercase hover:bg-[#9a7d0a] transition-colors disabled:opacity-60 shrink-0"
        >
          {status === 'loading' ? 'Joining...' : 'Request Access'}
        </button>
      </form>
      {emailError && (
        <p className="text-sm text-[#991b1b] mt-2">{emailError}</p>
      )}
      {status === 'error' && (
        <p className="text-sm text-[#991b1b] mt-2">Something went wrong. Try again.</p>
      )}
    </div>
  );
}
