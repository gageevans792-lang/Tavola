import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MobileNav } from '@/components/layout/MobileNav';
import { CommandPaletteMount } from '@/components/layout/CommandPaletteMount';
import { NotificationPanel } from '@/components/layout/NotificationPanel';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA]">
      {/* v2 — sidebar removed, drawer nav only */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
        <footer className="shrink-0 border-t border-[#E2E8F0] bg-white px-6 py-2 flex items-center justify-between">
          <span className="text-[10px] text-[#0A1628]/30">
            © 2025 Tavola · Paper Trading Beta
          </span>
          <div className="flex items-center gap-4 text-[10px]">
            <Link href="/legal/terms" className="text-[#0A1628]/30 hover:text-[#0A1628]/60 transition-colors">
              Terms
            </Link>
            <Link href="/legal/privacy" className="text-[#0A1628]/30 hover:text-[#0A1628]/60 transition-colors">
              Privacy
            </Link>
          </div>
        </footer>
      </div>
      {/* Nav drawer — triggered from TopBar grid button, all screen sizes */}
      <MobileNav />
      {/* Notification panel — triggered from TopBar bell icon */}
      <NotificationPanel />
      {/* Command palette — global, client-side */}
      <CommandPaletteMount />
    </div>
  );
}
