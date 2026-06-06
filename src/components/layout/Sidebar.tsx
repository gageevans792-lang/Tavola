'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BarChart2, CreditCard, Home, LineChart, LogOut, Settings } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard',  icon: Home },
  { href: '/insights',  label: 'AI Insights', icon: BarChart2 },
  { href: '/holdings',  label: 'Holdings',    icon: LineChart },
  { href: '/deposit',   label: 'Deposit',     icon: CreditCard },
  { href: '/settings',  label: 'Settings',    icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-[#E2E8F0] bg-white shrink-0">

      <div className="h-14 flex items-center px-6 border-b border-[#E2E8F0]">
        <Link href="/" className="font-serif text-[13px] tracking-[0.4em] uppercase text-[#0A1628]">
          Tavola
        </Link>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-6 py-2.5 text-[13px] transition-colors ${
                active
                  ? 'text-[#0A1628] bg-[#F8F9FA] border-r-2 border-[#B8960C] font-medium'
                  : 'text-[#4A5568] hover:text-[#0A1628] hover:bg-[#F8F9FA]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#E2E8F0] py-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-6 py-2.5 text-[13px] text-[#4A5568] hover:text-[#0A1628] hover:bg-[#F8F9FA] transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>

    </aside>
  );
}
