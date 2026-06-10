import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | Tavola',
  description: 'Tavola is building the AI investment platform that gives everyone access to institutional-quality portfolio management.',
};

export default function AboutPage() {
  return (
    <div className="bg-white text-[#0A1628]">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center bg-white border-b border-[#E2E8F0]">
        <div className="w-full flex items-center justify-between px-12 lg:px-20">
          <Link
            href="/"
            className="font-serif text-[13px] tracking-[0.4em] uppercase text-[#0A1628] hover:text-[#0A1628]/70 transition-colors"
          >
            Tavola
          </Link>
          <div className="flex items-center text-[12px]">
            <Link href="/about" className="px-5 text-[#0A1628] font-medium">About</Link>
            <span className="w-px h-3.5 bg-[#E2E8F0]" />
            <Link
              href="/login"
              className="px-5 text-[#0A1628]/50 hover:text-[#0A1628] transition-colors"
            >
              Sign In
            </Link>
            <span className="w-px h-3.5 bg-[#E2E8F0]" />
            <Link
              href="/signup"
              className="px-5 text-[#0A1628] hover:underline underline-offset-2 transition-all"
            >
              Open Account
            </Link>
          </div>
        </div>
      </nav>

      {/* ── SECTION 1: MISSION ── */}
      <section className="pt-32 pb-24 px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <span className="block text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-10">
            Our Mission
          </span>
          <h1 className="font-serif text-[52px] lg:text-[72px] font-light leading-[1.05] text-[#0A1628] mb-10 max-w-4xl">
            Everyone deserves a seat at the table.
          </h1>
          <p className="text-[16px] leading-[1.9] text-[#0A1628]/60 max-w-[560px] mb-6">
            For too long, sophisticated investing has been reserved for the wealthy. The best
            portfolio managers, the smartest strategies, the most advanced market intelligence,
            all locked behind minimum investments of $1 million or more.
          </p>
          <p className="text-[16px] leading-[1.9] text-[#0A1628]/60 max-w-[560px]">
            Tavola changes that. We built an AI that thinks, adapts, and executes like a Goldman
            Sachs portfolio manager. We put it in everyone&apos;s pocket. Free.
          </p>
          <div className="mt-14 w-full h-px bg-[#B8960C]/35" />
        </div>
      </section>

      {/* ── SECTION 2: THE PROBLEM ── */}
      <section className="py-24 px-12 lg:px-20 border-t border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 mb-16">
            <div>
              <div className="font-serif text-[56px] lg:text-[72px] font-light text-[#B8960C] leading-none mb-3">
                47 million
              </div>
              <div className="text-[12px] tracking-[0.18em] uppercase text-[#4A5568]">
                Americans have no investment portfolio
              </div>
            </div>
            <div>
              <div className="font-serif text-[56px] lg:text-[72px] font-light text-[#B8960C] leading-none mb-3">
                $30 trillion
              </div>
              <div className="text-[12px] tracking-[0.18em] uppercase text-[#4A5568]">
                in wealth managed exclusively for the top 1%
              </div>
            </div>
          </div>

          <div className="max-w-3xl border-t border-[#E2E8F0] pt-12 space-y-5">
            <p className="text-[15px] leading-[1.85] text-[#4A5568]">
              The financial system was not designed for you. It was designed for people who already
              have money. Minimum balances. Management fees. Jargon designed to confuse. Advisors
              who only call when you have something worth taking.
            </p>
            <p className="text-[15px] leading-[1.85] text-[#4A5568]">
              We built Tavola because we believe that is wrong.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: THE SOLUTION ── */}
      <section className="bg-[#0A1628] py-28 px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <span className="block text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-10">
            How Tavola Works
          </span>
          <div className="grid md:grid-cols-3 border border-white/10">
            {[
              {
                title: 'Your AI Portfolio Manager',
                body: 'Tavola AI analyzes thousands of data points every hour: market conditions, news sentiment, economic indicators, insider activity. It manages your portfolio the way a seasoned fund manager would, except it never sleeps, never takes a vacation, and never charges you $10,000 a year.',
              },
              {
                title: 'Institutional Strategy. Zero Minimums.',
                body: 'The same diversification strategies used by university endowments and family offices. Core positions in broad market ETFs. Tactical allocation to momentum sectors. Defensive positioning when markets get volatile. All automated. All explained in plain English.',
              },
              {
                title: 'Radical Transparency',
                body: 'Every trade comes with a full explanation. Why we bought, what we expect, what would make us sell. No black box. No fine print. You always know exactly what your money is doing and why.',
              },
            ].map(({ title, body }, i) => (
              <div
                key={title}
                className={`p-10 ${i < 2 ? 'border-b md:border-b-0 md:border-r border-white/10' : ''}`}
              >
                <h3 className="font-serif text-[22px] font-light text-white mb-5 leading-snug">
                  {title}
                </h3>
                <p className="text-[13px] leading-[1.85] text-white/45">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: VALUES ── */}
      <section className="py-28 px-12 lg:px-20 border-t border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto">
          <span className="block text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-10">
            What We Believe
          </span>
          <div className="grid md:grid-cols-2 gap-0">
            {[
              {
                value: 'Access is a right, not a privilege.',
                desc: 'Everyone deserves the same quality of financial management, regardless of their net worth.',
              },
              {
                value: 'Transparency builds trust.',
                desc: 'We explain every decision in plain English. Your money, your understanding.',
              },
              {
                value: 'Technology should serve people.',
                desc: 'AI is a tool for democratization, not exclusion. We put institutional-grade technology in the hands of everyday investors.',
              },
              {
                value: 'Long-term thinking wins.',
                desc: 'We build portfolios designed to compound wealth over years, not chase short-term gains.',
              },
            ].map(({ value, desc }, i) => (
              <div
                key={value}
                className={`py-10 pr-12 border-t border-[#E2E8F0] ${
                  i % 2 === 0 ? 'md:border-r' : 'md:pl-12 md:pr-0'
                }`}
              >
                <h3 className="font-serif text-[20px] font-light text-[#0A1628] mb-3 leading-snug">
                  {value}
                </h3>
                <p className="text-[13px] leading-[1.85] text-[#4A5568]">{desc}</p>
              </div>
            ))}
            <div className="col-span-full border-t border-[#E2E8F0]" />
          </div>
        </div>
      </section>

      {/* ── SECTION 5: FOUNDER NOTE ── */}
      <section className="bg-[#F8F9FA] border-t border-[#E2E8F0] py-28 px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl">
            <span className="block text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-10">
              A Note from Our Founder
            </span>
            <h2 className="font-serif text-[32px] font-light italic text-[#0A1628] mb-10 leading-snug">
              This started with a simple question.
            </h2>
            <div className="space-y-5 text-[15px] leading-[1.85] text-[#4A5568]">
              <p>
                I grew up watching people around me work incredibly hard and still struggle to
                build wealth. Not because they weren&apos;t smart enough or disciplined enough.
                But because the financial system was never designed to help them.
              </p>
              <p>
                The people who needed a portfolio manager the most could never afford one. The
                people who could afford one already had generational wealth working for them.
              </p>
              <p>
                I built Tavola to change that equation. To give everyone, regardless of
                background, net worth, or financial knowledge, access to the same quality of
                investment management that used to cost millions to access.
              </p>
              <p>
                Everyone deserves a seat at the table. That&apos;s why we named it Tavola.
              </p>
            </div>
            <div className="mt-10 pt-8 border-t border-[#E2E8F0]">
              <p className="font-serif text-[18px] font-light text-[#0A1628]">Gage Evans</p>
              <p className="text-[11px] tracking-[0.18em] uppercase text-[#B8960C] mt-1">
                Founder, Tavola
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: JOIN US ── */}
      <section className="py-28 px-12 lg:px-20 border-t border-[#E2E8F0] text-center">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-serif text-[42px] lg:text-[52px] font-light text-[#0A1628] mb-5 leading-tight">
            Ready to take your seat?
          </h2>
          <p className="text-[15px] leading-[1.75] text-[#4A5568] mb-12 max-w-sm mx-auto">
            Join thousands of investors who are letting AI work for them.
          </p>
          <div className="flex items-center justify-center gap-6">
            <Link
              href="/signup"
              className="bg-[#B8960C] text-white text-[12px] tracking-[0.2em] uppercase px-10 py-4 hover:bg-[#9a7d0a] transition-colors"
            >
              Open Your Account
            </Link>
            <Link
              href="/#how-it-works"
              className="border border-[#0A1628] text-[#0A1628] text-[12px] tracking-[0.2em] uppercase px-10 py-4 hover:bg-[#0A1628] hover:text-white transition-colors"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0A1628] pt-16 pb-10 px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <span className="font-serif text-[13px] tracking-[0.4em] uppercase text-white/35">
              Tavola
            </span>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <span className="text-[11px] text-white/20">© 2025 Tavola Financial, Inc.</span>
            <div className="flex items-center gap-6 text-[11px]">
              <Link href="/legal/terms" className="text-white/30 hover:text-white/60 transition-colors">
                Terms of Service
              </Link>
              <Link href="/legal/privacy" className="text-white/30 hover:text-white/60 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/legal" className="text-white/30 hover:text-white/60 transition-colors">
                Legal
              </Link>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-white/15">
            Paper trading platform for demonstration purposes only. Not investment advice.
          </p>
        </div>
      </footer>

    </div>
  );
}
