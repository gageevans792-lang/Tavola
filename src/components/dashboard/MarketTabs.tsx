'use client';
import { useState } from 'react';
import { NewsPanel } from '@/components/dashboard/NewsPanel';
import { MarketOverview } from '@/components/dashboard/MarketOverview';
import { Watchlist } from '@/components/dashboard/Watchlist';

const TABS = ['News', 'Market', 'Watchlist'] as const;
type Tab = typeof TABS[number];

export function MarketTabs() {
  const [active, setActive] = useState<Tab>('News');
  return (
    <div className="border border-[#E2E8F0] bg-white">
      {/* Tab bar */}
      <div className="flex border-b border-[#E2E8F0]">
        <p className="px-4 py-2.5 text-[10px] tracking-[0.15em] uppercase text-[#B8960C] flex items-center border-r border-[#E2E8F0]">
          Markets
        </p>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-5 py-2.5 text-[12px] tracking-[0.08em] transition-colors border-r border-[#E2E8F0] ${
              active === tab
                ? 'text-[#0A1628] border-b-2 border-b-[#B8960C] -mb-px bg-white'
                : 'text-[#4A5568] hover:text-[#0A1628]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div className="min-h-[200px]">
        {active === 'News'      && <NewsPanel />}
        {active === 'Market'    && <MarketOverview />}
        {active === 'Watchlist' && <Watchlist />}
      </div>
    </div>
  );
}
