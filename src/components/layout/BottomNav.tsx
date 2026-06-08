'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const MOBILE_NAV = [
  { href: '/dashboard',    label: 'Home'        },
  { href: '/markets',      label: 'Markets'     },
  { href: '/holdings',     label: 'Portfolio'   },
  { href: '/performance',  label: 'Performance' },
  { href: '/settings',     label: 'Settings'    },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex border-t border-[#E2E8F0] bg-white sm:hidden">
      {MOBILE_NAV.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center py-3 text-[10px] tracking-[0.08em] uppercase transition-colors relative',
              active ? 'text-[#0A1628] font-medium border-t-2 border-[#B8960C] -mt-px' : 'text-[#4A5568]',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
