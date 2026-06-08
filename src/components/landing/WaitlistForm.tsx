'use client';
import { useState } from 'react';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
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
      <div className="text-center py-4">
        <p className="font-serif text-xl font-light text-[#0A1628] mb-1">You're on the list.</p>
        <p className="text-sm text-[#4A5568]">We'll notify you when early access opens.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md">
      <input
        type="email"
        required
        placeholder="Your email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 border border-[#E2E8F0] px-4 h-12 text-[13px] text-[#0A1628] outline-none focus:border-[#0A1628] transition-colors placeholder:text-[#0A1628]/40 bg-white"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="bg-[#B8960C] text-white px-6 h-12 text-[11px] tracking-[0.2em] uppercase hover:bg-[#9a7d0a] transition-colors disabled:opacity-60 shrink-0"
      >
        {status === 'loading' ? 'Joining...' : 'Request Access'}
      </button>
      {status === 'error' && (
        <p className="text-xs text-red-600 mt-1">Something went wrong. Please try again.</p>
      )}
    </form>
  );
}
