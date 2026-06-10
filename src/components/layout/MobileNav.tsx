'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X, LayoutGrid, ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const PRIMARY_ITEMS = [
  { href: '/dashboard',   label: 'Home'      },
  { href: '/autopilot',   label: 'AutoPilot' },
  { href: '/holdings',    label: 'Holdings'  },
];

const EXPLORE_ITEMS = [
  { href: '/performance',  label: 'Performance'  },
  { href: '/intelligence', label: 'Intelligence' },
  { href: '/markets',      label: 'Markets'      },
  { href: '/backtest',     label: 'Backtest'     },
  { href: '/chat',         label: 'AI Chat'      },
];

export function MobileMenuButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('tavola:open-mobile-menu'))}
      className="flex items-center justify-center h-8 w-8 border border-[#E2E8F0] text-[#0A1628] hover:border-[#0A1628] transition-colors"
      aria-label="Open navigation"
    >
      <LayoutGrid className="h-3.5 w-3.5" />
    </button>
  );
}

export function MobileNav() {
  const [open,          setOpen]          = useState(false);
  const [equity,        setEquity]        = useState<string | null>(null);
  const [equityLoading, setEquityLoading] = useState(false);
  const [exploreOpen,   setExploreOpen]   = useState(false);
  const pathname = usePathname();
  const router   = useRouter();

  // Open on custom event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('tavola:open-mobile-menu', handler);
    return () => window.removeEventListener('tavola:open-mobile-menu', handler);
  }, []);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Auto-expand Explore if current route is in it
  useEffect(() => {
    if (EXPLORE_ITEMS.some(i => i.href === pathname)) setExploreOpen(true);
  }, [pathname]);

  // ESC key closes the drawer
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Lock scroll + fetch equity when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setEquityLoading(true);
      setEquity(null);
      fetch('/api/alpaca/portfolio')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          setEquity(d?.equity
            ? '$' + Number(d.equity).toLocaleString('en-US', { maximumFractionDigits: 0 })
            : '–');
        })
        .catch(() => { setEquity('–'); })
        .finally(() => { setEquityLoading(false); });
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

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
        onClick={() => setOpen(false)}
        className={`flex items-center px-6 py-2.5 text-[13px] transition-colors border-l-2 ${
          active
            ? 'text-white bg-white/5 border-[#B8960C]'
            : 'text-white/55 hover:text-white hover:bg-white/5 border-transparent'
        }`}
      >
        {label}
        {active && <span className="ml-auto h-1 w-1 rounded-full bg-[#B8960C]" />}
      </Link>
    );
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#0A1628]/60 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <aside
            className="absolute top-0 right-0 bottom-0 flex flex-col bg-[#0A1628] shadow-2xl animate-[slideInRight_0.25s_ease-out]"
            style={{ width: 'min(76vw, 300px)' }}
          >
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-white/10 shrink-0">
              <span className="font-serif text-[12px] tracking-[0.4em] uppercase text-white">Tavola</span>
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center h-7 w-7 text-white/40 hover:text-white transition-colors"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Portfolio value */}
            <div className="px-6 py-4 border-b border-white/10 shrink-0">
              <p className="text-[9px] tracking-[0.2em] uppercase text-white/30 mb-0.5">Portfolio Value</p>
              {equityLoading
                ? <div className="h-[22px] w-28 animate-pulse rounded bg-white/10" />
                : <p className="font-mono text-[18px] text-white tabular-nums">{equity ?? '–'}</p>
              }
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-3">
              {/* Primary */}
              <div className="mb-1">
                {PRIMARY_ITEMS.map(({ href, label }) => navLink(href, label))}
              </div>

              {/* Divider */}
              <div className="mx-6 my-2 h-px bg-white/[0.08]" />

              {/* Explore — collapsible */}
              <div>
                <button
                  onClick={() => setExploreOpen(o => !o)}
                  className="flex w-full items-center justify-between px-6 pt-2 pb-1.5 text-[9px] tracking-[0.3em] uppercase text-white/25 hover:text-white/40 transition-colors"
                >
                  <span>Explore</span>
                  {exploreOpen
                    ? <ChevronDown className="h-3 w-3" />
                    : <ChevronRight className="h-3 w-3" />
                  }
                </button>
                {exploreOpen && EXPLORE_ITEMS.map(({ href, label }) => navLink(href, label))}
              </div>

              {/* Divider */}
              <div className="mx-6 my-2 h-px bg-white/[0.08]" />

              {/* Settings */}
              {navLink('/settings', 'Settings')}
            </nav>

            {/* Footer */}
            <div className="border-t border-white/10 py-3 shrink-0">
              <div className="flex items-center gap-4 px-6 pb-2">
                <Link href="/about"         className="text-[10px] tracking-[0.1em] uppercase text-white/25 hover:text-white/50 transition-colors">About</Link>
                <Link href="/legal/terms"   className="text-[10px] tracking-[0.1em] uppercase text-white/25 hover:text-white/50 transition-colors">Terms</Link>
                <Link href="/legal/privacy" className="text-[10px] tracking-[0.1em] uppercase text-white/25 hover:text-white/50 transition-colors">Privacy</Link>
              </div>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center px-6 py-2 text-[12px] tracking-[0.08em] uppercase text-white/30 hover:text-white/60 transition-colors"
              >
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
