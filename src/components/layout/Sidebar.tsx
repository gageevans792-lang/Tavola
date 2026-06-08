'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/dashboard',    label: 'Dashboard'    },
  { href: '/autonomous',   label: 'AI Agent'     },
  { href: '/strategy',     label: 'Strategy'     },
  { href: '/insights',     label: 'AI Insights'  },
  { href: '/intelligence', label: 'Intelligence' },
  { href: '/holdings',     label: 'Holdings'     },
  { href: '/deposit',      label: 'Deposit'      },
  { href: '/settings',     label: 'Settings'     },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

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

      <nav className="flex-1 py-4">
        {navItems.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-6 py-2.5 text-[13px] transition-colors ${
                active
                  ? 'text-white bg-white/5 border-l-2 border-[#B8960C]'
                  : 'text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

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
