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
      <p className="text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-6">System Error</p>
      <h1 className="font-serif text-[44px] lg:text-[56px] font-light text-[#0A1628] leading-tight mb-4">
        Something went wrong.
      </h1>
      <p className="text-[15px] text-[#4A5568] max-w-sm mb-3 leading-relaxed">
        An unexpected error occurred. Our team has been notified automatically.
      </p>
      <p className="text-[13px] text-[#4A5568]/60 mb-10">
        Please try again or return to the home page.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={unstable_retry}
          className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:bg-[#162035] transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="border border-[#E2E8F0] text-[#0A1628] text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:border-[#0A1628] transition-colors"
        >
          Return Home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-10 text-[10px] text-[#4A5568]/40 font-mono">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
