import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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
      {/* v2 — sidebar removed, drawer nav only */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
      {/* Nav drawer — triggered from TopBar grid button, all screen sizes */}
      <MobileNav />
      {/* Command palette — global, client-side */}
      <CommandPaletteMount />
    </div>
  );
}
