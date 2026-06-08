'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const MOBILE_NAV = [
  { href: '/dashboard',   label: 'Home'      },
  { href: '/autopilot',  label: 'AutoPilot'  },
  { href: '/intelligence', label: 'Markets'  },
  { href: '/holdings',   label: 'Portfolio'  },
  { href: '/settings',   label: 'Settings'   },
];

export function BottomNav() {
  const pathname = usePathname();
  const [autopilotActive, setAutopilotActive] = useState(false);

  useEffect(() => {
    fetch('/api/autopilot/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { enabled?: boolean } | null) => {
        if (d && typeof d.enabled === 'boolean') setAutopilotActive(d.enabled);
      })
      .catch(() => {});
  }, []);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex border-t border-[#E2E8F0] bg-white sm:hidden">
      {MOBILE_NAV.map(({ href, label }) => {
        const active = pathname === href;
        const isAutopilot = href === '/autopilot';
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center py-3 text-[10px] tracking-[0.08em] uppercase transition-colors relative',
              active ? 'text-[#0A1628] font-medium border-t-2 border-[#B8960C] -mt-px' : 'text-[#4A5568]',
            )}
          >
            {/* Gold indicator dot for AutoPilot when active */}
            {isAutopilot && autopilotActive && !active && (
              <span className="absolute top-2 w-1.5 h-1.5 bg-[#B8960C]" />
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
