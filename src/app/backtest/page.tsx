import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BacktestEngine } from '@/components/backtest/BacktestEngine';

export default async function BacktestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const authed = !!user;

  return (
    <div className="bg-white text-[#0A1628]">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center border-b border-[#E2E8F0] bg-white">
        <div className="w-full flex items-center justify-between px-8">
          <Link href="/" className="font-serif text-[13px] tracking-[0.4em] uppercase text-[#0A1628]">
            Tavola
          </Link>
          <div className="flex items-center text-[12px]">
            {authed ? (
              <Link href="/dashboard" className="px-5 text-[#0A1628]/60 hover:text-[#0A1628] transition-colors">
                Back to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-5 text-[#0A1628]/50 hover:text-[#0A1628] transition-colors">
                  Sign In
                </Link>
                <span className="w-px h-3.5 bg-[#E2E8F0]" />
                <Link href="/signup" className="px-5 text-[#0A1628] hover:underline underline-offset-2">
                  Open Account
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="pt-14">
        <BacktestEngine isPublic={!authed} />
      </div>

    </div>
  );
}
