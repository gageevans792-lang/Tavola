'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X, LayoutGrid } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const NAV_SECTIONS = [
  {
    heading: 'Overview',
    items: [
      { href: '/dashboard',   label: 'Dashboard'   },
      { href: '/performance', label: 'Performance' },
      { href: '/markets',     label: 'Markets'     },
    ],
  },
  {
    heading: 'AI',
    items: [
      { href: '/chat',         label: 'AI Chat'      },
      { href: '/autonomous',   label: 'AI Agent'     },
      { href: '/autopilot',    label: 'AutoPilot'    },
      { href: '/strategy',     label: 'Strategy'     },
      { href: '/insights',     label: 'AI Insights'  },
      { href: '/intelligence', label: 'Intelligence' },
    ],
  },
  {
    heading: 'Account',
    items: [
      { href: '/holdings', label: 'Portfolio'     },
      { href: '/trades',   label: 'Trade History' },
      { href: '/bank',     label: 'Banking'       },
      { href: '/deposit',  label: 'Deposit'       },
      { href: '/settings', label: 'Settings'      },
    ],
  },
];

export function MobileMenuButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('tavola:open-mobile-menu'))}
      className="sm:hidden flex items-center justify-center h-8 w-8 border border-[#E2E8F0] text-[#0A1628] hover:border-[#0A1628] transition-colors"
      aria-label="Open navigation"
    >
      <LayoutGrid className="h-3.5 w-3.5" />
    </button>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [equity, setEquity] = useState<string | null>(null);
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('tavola:open-mobile-menu', handler);
    return () => window.removeEventListener('tavola:open-mobile-menu', handler);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      fetch('/api/alpaca/portfolio')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.equity) {
            setEquity('$' + Number(d.equity).toLocaleString('en-US', { maximumFractionDigits: 0 }));
          }
        })
        .catch(() => {});
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

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 sm:hidden"
          aria-modal="true"
          role="dialog"
        >
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-[#0A1628]/60 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          {/* Drawer — slides in from right */}
          <aside
            className="absolute top-0 right-0 bottom-0 flex flex-col bg-[#0A1628] shadow-2xl"
            style={{ width: 'min(76vw, 300px)' }}
          >
            {/* Drawer header */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-white/10 shrink-0">
              <span className="font-serif text-[12px] tracking-[0.4em] uppercase text-white">
                Tavola
              </span>
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center h-7 w-7 text-white/40 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Portfolio equity — if loaded */}
            {equity && (
              <div className="px-6 py-4 border-b border-white/10 shrink-0">
                <p className="text-[9px] tracking-[0.2em] uppercase text-white/30 mb-0.5">
                  Portfolio Value
                </p>
                <p className="font-mono text-[18px] text-white tabular-nums">{equity}</p>
              </div>
            )}

            {/* Nav sections */}
            <nav className="flex-1 overflow-y-auto py-3">
              {NAV_SECTIONS.map((section, si) => (
                <div key={section.heading}>
                  {si > 0 && <div className="mx-6 my-1.5 h-px bg-white/8" />}
                  <p className="px-6 pt-3 pb-1.5 text-[9px] tracking-[0.3em] uppercase text-white/25">
                    {section.heading}
                  </p>
                  {section.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center px-6 py-2.5 text-[13px] transition-colors border-l-2 ${
                          active
                            ? 'text-white bg-white/5 border-[#B8960C]'
                            : 'text-white/55 hover:text-white hover:bg-white/5 border-transparent'
                        }`}
                      >
                        {item.label}
                        {active && (
                          <span className="ml-auto h-1 w-1 rounded-full bg-[#B8960C]" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Sign out */}
            <div className="border-t border-white/10 py-3 shrink-0">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center px-6 py-2.5 text-[12px] tracking-[0.08em] uppercase text-white/30 hover:text-white/60 transition-colors"
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
