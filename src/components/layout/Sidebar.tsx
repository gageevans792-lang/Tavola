'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const PRIMARY_LINKS = [
  { href: '/dashboard',    label: 'Home'      },
  { href: '/autopilot',    label: 'AutoPilot' },
  { href: '/holdings',     label: 'Holdings'  },
];

const EXPLORE_LINKS = [
  { href: '/performance',  label: 'Performance'  },
  { href: '/intelligence', label: 'Intelligence' },
  { href: '/markets',      label: 'Markets'      },
  { href: '/backtest',     label: 'Backtest'     },
  { href: '/chat',         label: 'AI Chat'      },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [equity,       setEquity]       = useState<string | null>(null);
  const [dayPl,        setDayPl]        = useState<{ value: string; positive: boolean } | null>(null);
  const [exploreOpen,  setExploreOpen]  = useState(() =>
    EXPLORE_LINKS.some(l => pathname === l.href)
  );

  // Keep Explore open when navigating to an Explore route
  useEffect(() => {
    if (EXPLORE_LINKS.some(l => pathname === l.href)) setExploreOpen(true);
  }, [pathname]);

  useEffect(() => {
    fetch('/api/alpaca/portfolio')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setEquity('$' + Math.abs(d.equity).toLocaleString('en-US', { maximumFractionDigits: 0 }));
        const pl = d.day_pl ?? 0;
        setDayPl({
          value:    (pl >= 0 ? '+' : '-') + '$' + Math.abs(pl).toLocaleString('en-US', { maximumFractionDigits: 0 }),
          positive: pl >= 0,
        });
      })
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function navLink(href: string, label: string) {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center px-6 py-2 text-[13px] transition-colors border-l-2 ${
          active
            ? 'text-white bg-white/5 border-[#B8960C]'
            : 'text-white/60 hover:text-white hover:bg-white/5 border-transparent'
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <aside className="flex h-full w-56 flex-col bg-[#0A1628] shrink-0">

      <div className="h-14 flex items-center px-6 border-b border-white/10">
        <Link href="/" className="font-serif text-[13px] tracking-[0.4em] uppercase text-white">
          Tavola
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {/* Primary links */}
        <div className="mb-2">
          {PRIMARY_LINKS.map(({ href, label }) => navLink(href, label))}
        </div>

        {/* Divider */}
        <div className="mx-6 my-2 h-px bg-white/[0.08]" />

        {/* Explore section — collapsible */}
        <div>
          <button
            onClick={() => setExploreOpen(o => !o)}
            className="flex w-full items-center justify-between px-6 pt-3 pb-1.5 text-[8px] tracking-[0.25em] uppercase text-white/25 font-medium hover:text-white/40 transition-colors"
          >
            <span>Explore</span>
            {exploreOpen
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />
            }
          </button>

          {exploreOpen && (
            <div>
              {EXPLORE_LINKS.map(({ href, label }) => navLink(href, label))}
            </div>
          )}
        </div>
      </nav>

      {/* Portfolio value */}
      {equity && (
        <div className="border-t border-white/10 px-6 py-4">
          <p className="text-[9px] tracking-[0.15em] uppercase text-white/30 mb-1">Portfolio</p>
          <p className="font-mono text-[15px] text-white tabular-nums">{equity}</p>
          {dayPl && (
            <p className={`text-[11px] tabular-nums mt-0.5 ${dayPl.positive ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
              {dayPl.value} today
            </p>
          )}
        </div>
      )}

      <div className="px-6 pb-1">
        <p className="text-[9px] text-white/20 tracking-[0.1em]">⌘K quick nav</p>
      </div>

      <div className="border-t border-white/10 py-2">
        <Link
          href="/settings"
          className={`flex items-center px-6 py-2 text-[13px] transition-colors border-l-2 ${
            pathname === '/settings'
              ? 'text-white bg-white/5 border-[#B8960C]'
              : 'text-white/40 hover:text-white/70 border-transparent'
          }`}
        >
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center px-6 py-2 text-[13px] text-white/40 hover:text-white/70 transition-colors"
        >
          Sign out
        </button>
      </div>

    </aside>
  );
}
