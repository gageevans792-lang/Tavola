'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[Tavola] Runtime error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6">
      <p className="text-[10px] tracking-[0.25em] uppercase text-[#991b1b] mb-4">System Error</p>
      <h1 className="font-serif text-[52px] font-light text-[#0A1628] leading-none mb-4">
        Something went wrong
      </h1>
      <p className="text-[15px] text-[#4A5568] max-w-sm mb-10 leading-relaxed">
        An unexpected error occurred. Our team has been notified. Please try again or contact support.
      </p>
      <div className="flex gap-4">
        <button
          onClick={unstable_retry}
          className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:bg-[#162035] transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/dashboard"
          className="border border-[#E2E8F0] text-[#0A1628] text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:border-[#0A1628] transition-colors"
        >
          Dashboard
        </Link>
      </div>
      {error.digest && (
        <p className="mt-8 text-[10px] text-[#4A5568]/50 font-mono">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
