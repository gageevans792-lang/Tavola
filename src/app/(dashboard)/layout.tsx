import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { CommandPaletteMount } from '@/components/layout/CommandPaletteMount';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA]">
      {/* Sidebar: hidden on mobile */}
      <div className="hidden sm:block">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
      {/* Mobile nav drawer — triggered from TopBar menu button */}
      <MobileNav />
      {/* Command palette — global, client-side */}
      <CommandPaletteMount />
    </div>
  );
}
