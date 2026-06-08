'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type NavLink = { href: string; label: string };
type NavDivider = { divider: true };
type NavItem = NavLink | NavDivider;

const navItems: NavItem[] = [
  { href: '/dashboard',    label: 'Dashboard'    },
  { href: '/autopilot',   label: 'AutoPilot'     },
  { href: '/autonomous',  label: 'AI Agent'       },
  { href: '/strategy',    label: 'Strategy'       },
  { href: '/insights',    label: 'AI Insights'    },
  { href: '/intelligence', label: 'Intelligence' },
  { divider: true },
  { href: '/holdings',    label: 'Holdings'       },
  { href: '/trades',      label: 'Trade History'  },
  { href: '/bank',        label: 'Banking'        },
  { divider: true },
  { href: '/deposit',     label: 'Deposit'        },
  { href: '/settings',    label: 'Settings'       },
];

function isDivider(item: NavItem): item is NavDivider {
  return 'divider' in item;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [equity, setEquity] = useState<string | null>(null);
  const [dayPl, setDayPl] = useState<{ value: string; positive: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/alpaca/portfolio')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setEquity('$' + Math.abs(d.equity).toLocaleString('en-US', { maximumFractionDigits: 0 }));
        const pl = d.day_pl ?? 0;
        setDayPl({
          value: (pl >= 0 ? '+' : '-') + '$' + Math.abs(pl).toLocaleString('en-US', { maximumFractionDigits: 0 }),
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

  return (
    <aside className="flex h-full w-56 flex-col bg-[#0A1628] shrink-0">

      <div className="h-14 flex items-center px-6 border-b border-white/10">
        <Link href="/" className="font-serif text-[13px] tracking-[0.4em] uppercase text-white">
          Tavola
        </Link>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item, idx) => {
          if (isDivider(item)) {
            return <div key={`divider-${idx}`} className="mx-6 my-2 h-px bg-white/10" />;
          }
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-6 py-2.5 text-[13px] transition-colors ${
                active
                  ? 'text-white bg-white/5 border-l-2 border-[#B8960C]'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Portfolio mini */}
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

      <div className="border-t border-white/10 py-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center px-6 py-2.5 text-[13px] text-white/40 hover:text-white/70 transition-colors"
        >
          Sign out
        </button>
      </div>

    </aside>
  );
}
