'use client';

import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';

export default function InsightsPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar title="AI Insights" />
      <main className="flex-1 overflow-y-auto bg-[#F8F9FA] flex items-center justify-center p-8">
        <div className="bg-white border border-[#E2E8F0] px-8 py-16 text-center max-w-md w-full">
          <p className="text-[10px] tracking-[0.25em] uppercase text-[#B8960C] mb-4">Moved</p>
          <h3 className="font-serif text-[24px] font-light text-[#0A1628] mb-3 leading-tight">
            AI Insights has moved.
          </h3>
          <p className="text-[14px] text-[#4A5568] max-w-sm mx-auto mb-8 leading-relaxed">
            The AI Insights log and Weekly Letter are now on the Intelligence page under the Letters tab.
          </p>
          <Link
            href="/intelligence"
            className="inline-block bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:bg-[#162035] transition-colors"
          >
            Go to Intelligence
          </Link>
        </div>
      </main>
    </div>
  );
}
