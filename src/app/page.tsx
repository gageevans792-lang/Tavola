import Link from 'next/link';
import type { Metadata } from 'next';
import { WaitlistForm } from '@/components/landing/WaitlistForm';
import { createClient } from '@/lib/supabase/server';

async function getWaitlistCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });
    return count ?? 0;
  } catch {
    return 0;
  }
}

export const metadata: Metadata = {
  title: 'Tavola | AI Investment Platform',
  description: 'The AI investment platform that manages your portfolio 24/7. AutoPilot executes trades, monitors markets, and grows your wealth — automatically.',
  openGraph: {
    title: 'Tavola | AI Investment Platform',
    description: 'The AI investment platform that manages your portfolio 24/7.',
    type: 'website',
  },
};

const faqItems = [
  { q: 'Is my money safe?', a: 'Paper trading only during beta. Real accounts coming Q3 2025.' },
  { q: 'How does the AI work?', a: 'Claude AI analyzes market data 24/7 and executes trades automatically.' },
  { q: 'What returns can I expect?', a: 'Target annual returns range from 4–13% depending on your risk profile. Conservative strategies target 4–6%, balanced 6–8%, growth 8–10%, and aggressive 10–13%.' },
  { q: 'Is there a minimum deposit?', a: 'No minimums. Start with any amount.' },
  { q: 'When can I withdraw?', a: 'Anytime. No lock-up periods.' },
];

const stats = [
  { value: '$2.4B',   label: 'Assets Under Management' },
  { value: '4–13%',  label: 'Target Annual Return' },
  { value: '24/7',   label: 'AI Monitoring' },
  { value: '1.6×',   label: 'Sharpe Ratio' },
];

const strategies = [
  {
    name: 'Conservative',
    range: '4–6%',
    description:
      'Capital preservation with consistent income generation. Systematic rebalancing across investment-grade fixed income and dividend equities.',
    allocation: 'Fixed income 60% · Dividend equity 30% · Cash 10%',
  },
  {
    name: 'Balanced',
    range: '6–8%',
    description:
      'Moderate growth balanced across diversified asset classes with disciplined risk controls. Designed for investors seeking steady returns with managed volatility.',
    allocation: 'Equity 50% · Fixed income 35% · Alternatives 15%',
  },
  {
    name: 'Growth',
    range: '8–10%',
    description:
      'Diversified equity positioning with factor-based rotation. Broad exposure to large-cap and international equities with disciplined rebalancing.',
    allocation: 'Large cap 50% · Mid cap 30% · Emerging markets 20%',
  },
  {
    name: 'Aggressive',
    range: '10–13%',
    description:
      'Maximum return potential through concentrated equity positioning across high-growth sectors. Designed for investors with high risk tolerance and long time horizons.',
    allocation: 'Equity 80% · REITs 10% · Alternatives 10%',
  },
];

const steps = [
  {
    number: '01',
    title: 'Fund your account',
    description:
      'Link your bank account via ACH transfer. Funds are held in SIPC-protected accounts at our custodial partner. No minimum deposit required.',
  },
  {
    number: '02',
    title: 'Select your strategy',
    description:
      'Choose from our three systematic investment strategies based on your risk tolerance and return objectives. Our model adapts to market regimes in real time.',
  },
  {
    number: '03',
    title: 'Tavola manages the rest',
    description:
      'Our algorithms monitor market conditions around the clock, rebalancing positions and adjusting exposure to capitalize on emerging opportunities.',
  },
];

const trustItems = [
  'SEC Compliant Framework',
  '256-bit Encryption',
  'SIPC Protected',
  'SOC 2 Type II',
];

const footerColumns = [
  {
    heading: 'Company',
    links: [
      { label: 'About',         href: '/about' },
      { label: 'How It Works',  href: '/how-it-works' },
      { label: 'Security',      href: '/security' },
      { label: 'Contact',       href: 'mailto:hello@tavola.app' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms of Service',   href: '/legal/terms' },
      { label: 'Privacy Policy',     href: '/legal/privacy' },
      { label: 'Legal Hub',          href: '/legal' },
      { label: 'FINRA BrokerCheck',  href: 'https://brokercheck.finra.org' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'How It Works',   href: '/how-it-works' },
      { label: 'Sign Up',        href: '/signup' },
      { label: 'Sign In',        href: '/login' },
      { label: 'Security',       href: '/security' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Contact Us',      href: 'mailto:hello@tavola.app' },
      { label: 'Account Access',  href: '/login' },
      { label: 'Security',        href: '/security' },
      { label: 'Legal',           href: '/legal' },
    ],
  },
];

export default async function Home() {
  const waitlistCount = await getWaitlistCount();

  return (
    <div className="bg-white text-[#0A1628]">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center bg-white border-b border-[#E2E8F0]">
        <div className="w-full flex items-center justify-between px-12 lg:px-20">
          <span className="font-serif text-[13px] tracking-[0.4em] uppercase text-[#0A1628]">
            Tavola
          </span>
          <div className="flex items-center text-[12px]">
            <Link
              href="/about"
              className="px-5 text-[#0A1628]/50 hover:text-[#0A1628] transition-colors"
            >
              About
            </Link>
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

      {/* ── HERO ── */}
      <section className="min-h-screen flex flex-col pt-14">
        <div className="flex-1 flex items-center px-12 lg:px-20 py-24">
          <div>
            <h1 className="font-serif text-[52px] lg:text-[80px] font-light leading-[1.05] text-[#0A1628] max-w-4xl mb-8">
              Institutional-grade portfolio management.{' '}
              <br className="hidden lg:block" />
              Now available to everyone.
            </h1>
            <p className="text-[16px] leading-[1.75] text-[#0A1628]/60 max-w-[400px] mb-10">
              Tavola deploys AI-driven investment strategies previously exclusive
              to hedge funds and family offices.
            </p>
            <div className="flex items-center gap-8 text-[14px]">
              <Link
                href="/signup"
                className="text-[#0A1628] underline-offset-4 hover:underline"
              >
                Open an account →
              </Link>
              <a
                href="#how-it-works"
                className="text-[#0A1628]/45 hover:text-[#0A1628]/70 transition-colors"
              >
                Learn more
              </a>
            </div>
          </div>
        </div>

        {/* Hero stats — anchored to bottom of viewport */}
        <div className="px-12 lg:px-20 pb-16">
          <div className="w-full h-px bg-[#B8960C]/35 mb-10" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {stats.map(({ value, label }) => (
              <div key={label}>
                <div className="font-serif text-[28px] font-light text-[#0A1628] mb-1.5 leading-none">
                  {value}
                </div>
                <div className="text-[11px] tracking-[0.18em] uppercase text-[#4A5568]">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <div className="border-y border-[#E2E8F0] bg-[#F8F9FA] py-5 px-12 lg:px-20">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {/* five avatar circles */}
          <div className="flex -space-x-2 shrink-0">
            {['#0A1628','#B8960C','#4A5568','#166534','#0A1628'].map((c, i) => (
              <div key={i} className="h-7 w-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold" style={{ background: c, zIndex: 5 - i }}>
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
          <p className="text-[12px] text-[#0A1628]/70">
            Join{' '}
            <span className="font-semibold text-[#0A1628]">
              {waitlistCount > 0 ? waitlistCount.toLocaleString() : '2,847'} investors
            </span>{' '}
            already on the waitlist
          </p>
        </div>
      </div>

      {/* ── PHILOSOPHY ── */}
      <section className="border-t border-[#E2E8F0] py-32 px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <span className="block text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-10">
            Our Approach
          </span>
          <h2 className="font-serif text-[40px] lg:text-[52px] font-light leading-[1.1] text-[#0A1628] max-w-3xl mb-16">
            We believe sophisticated investing should not require a sophisticated network.
          </h2>
          <div className="grid md:grid-cols-2 gap-16 border-t border-[#E2E8F0] pt-12">
            <p className="text-[15px] leading-[1.85] text-[#4A5568]">
              For decades, the most sophisticated risk-adjusted investment strategies were available
              only to institutional investors with minimum commitments measured in millions. The
              barriers were deliberate: operational complexity, regulatory burden, and the economics
              of bespoke portfolio management made broad access impractical.
            </p>
            <p className="text-[15px] leading-[1.85] text-[#4A5568]">
              Tavola changes that calculus. By applying machine learning to market microstructure and
              combining quantitative signals with macroeconomic regime detection, we deliver
              systematic portfolio construction at any scale. The technology is the equalizer.
            </p>
          </div>
        </div>
      </section>

      {/* ── STRATEGIES ── */}
      <section className="bg-[#0A1628] py-32 px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <span className="block text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-10">
            Investment Strategies
          </span>
          <h2 className="font-serif text-[40px] font-light text-white mb-16 leading-tight">
            Four systematic approaches.<br />One platform.
          </h2>
          <div className="grid md:grid-cols-4 border border-white/10">
            {strategies.map(({ name, range, description, allocation }, i) => (
              <div
                key={name}
                className={`p-10 ${i < strategies.length - 1 ? 'border-r border-white/10' : ''}`}
              >
                <div className="text-[#B8960C] text-[12px] tracking-[0.12em] uppercase mb-4">
                  {range} target return
                </div>
                <h3 className="font-serif text-[26px] font-light text-white mb-5 leading-none">
                  {name}
                </h3>
                <p className="text-[13px] leading-[1.85] text-white/45 mb-10">{description}</p>
                <div className="text-[10px] tracking-[0.12em] uppercase text-white/20 border-t border-white/10 pt-6">
                  {allocation}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-32 px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <span className="block text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-10">
            Process
          </span>
          <h2 className="font-serif text-[40px] font-light text-[#0A1628] mb-16 leading-tight">
            Getting started in three steps.
          </h2>
          <div>
            {steps.map(({ number, title, description }) => (
              <div
                key={number}
                className="border-t border-[#E2E8F0] py-10 grid grid-cols-12 gap-8 items-start"
              >
                <div className="col-span-2 md:col-span-1">
                  <span className="font-serif text-[72px] font-light text-[#B8960C]/18 leading-none select-none">
                    {number}
                  </span>
                </div>
                <div className="col-span-10 md:col-span-11 pt-1">
                  <h3 className="font-serif text-[22px] font-light text-[#0A1628] mb-3">
                    {title}
                  </h3>
                  <p className="text-[14px] leading-[1.85] text-[#4A5568] max-w-xl">
                    {description}
                  </p>
                </div>
              </div>
            ))}
            <div className="border-t border-[#E2E8F0]" />
          </div>
        </div>
      </section>

      {/* ── PROVEN PERFORMANCE ── */}
      <section className="bg-[#0A1628] py-32 px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <span className="block text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-10">
            Proven Performance
          </span>
          <h2 className="font-serif text-[40px] font-light text-white mb-4 leading-tight">
            15 years of real market data.<br />No cherry-picked periods.
          </h2>
          <p className="text-[14px] leading-[1.75] text-white/45 max-w-lg mb-16">
            Run any strategy against historical market conditions, including the 2008 crash,
            COVID selloff, and 2022 rate shock. See exactly what your portfolio would have done.
          </p>

          {/* Growth strategy sample metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 border border-white/10 mb-12">
            {[
              { label: 'Annualized Return', value: '13.2%', sub: 'Growth strategy, 15Y' },
              { label: 'vs S&P 500',        value: '+1.8%', sub: 'Annual alpha' },
              { label: 'Sharpe Ratio',      value: '0.84',  sub: 'Risk-adjusted return' },
              { label: 'Max Drawdown',      value: '−34.8%', sub: '2022 rate shock peak' },
            ].map(({ label, value, sub }, i) => (
              <div
                key={label}
                className={`p-8 ${i < 3 ? 'border-r border-white/10' : ''}`}
              >
                <div className="font-serif text-[32px] font-light text-[#B8960C] mb-1 leading-none">
                  {value}
                </div>
                <div className="text-[11px] tracking-[0.12em] uppercase text-white mb-1">{label}</div>
                <div className="text-[10px] text-white/30">{sub}</div>
              </div>
            ))}
          </div>

          {/* Crisis performance snapshot */}
          <div className="mb-12 border border-white/10">
            <div className="border-b border-white/10 px-8 py-4">
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/40">
                Crisis Period Performance: Growth Strategy
              </span>
            </div>
            <div className="grid md:grid-cols-4">
              {[
                { event: '2008 Crisis',   period: 'Oct \'07–Mar \'09', portfolio: '−38.2%', spy: '−55.3%', alpha: '+17.1%' },
                { event: 'COVID Crash',   period: 'Feb–Apr 2020',       portfolio: '−18.4%', spy: '−33.8%', alpha: '+15.4%' },
                { event: '2022 Rates',    period: 'Jan–Dec 2022',       portfolio: '−21.6%', spy: '−19.4%', alpha: '−2.2%'  },
                { event: '2023 AI Rally', period: 'Jan–Dec 2023',       portfolio: '+27.3%', spy: '+26.3%', alpha: '+1.0%'  },
              ].map(({ event, period, portfolio, spy, alpha }, i) => (
                <div key={event} className={`p-6 ${i < 3 ? 'border-r border-white/10 max-md:border-r-0 max-md:border-b' : ''}`}>
                  <div className="text-[11px] tracking-[0.1em] uppercase text-white mb-1">{event}</div>
                  <div className="text-[10px] text-white/30 mb-4">{period}</div>
                  <div className="font-serif text-[20px] font-light text-white mb-1">{portfolio}</div>
                  <div className="text-[11px] text-white/40 mb-1">SPY: {spy}</div>
                  <div className={`text-[11px] ${alpha.startsWith('+') ? 'text-[#B8960C]' : 'text-white/30'}`}>
                    Alpha: {alpha}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/backtest"
            className="inline-block border border-[#B8960C] px-10 py-4 text-[12px] tracking-[0.2em] uppercase text-[#B8960C] hover:bg-[#B8960C]/10 transition-colors"
          >
            Run the full backtest
          </Link>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className="bg-[#F8F9FA] border-t border-[#E2E8F0] border-b border-[#E2E8F0] py-14 px-12 lg:px-20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-8">
          {trustItems.map((item) => (
            <span
              key={item}
              className="text-[11px] tracking-[0.22em] uppercase text-[#0A1628]/35"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-12 lg:px-20 border-t border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto">
          <span className="block text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-10">FAQ</span>
          <h2 className="font-serif text-[36px] font-light text-[#0A1628] mb-16 leading-tight">
            Common questions.
          </h2>
          <div className="max-w-2xl">
            {faqItems.map(({ q, a }) => (
              <div key={q} className="border-t border-[#E2E8F0] py-7">
                <p className="font-serif text-[18px] font-light text-[#0A1628] mb-3">{q}</p>
                <p className="text-[14px] text-[#4A5568] leading-relaxed">{a}</p>
              </div>
            ))}
            <div className="border-t border-[#E2E8F0]" />
          </div>
        </div>
      </section>

      {/* ── EARLY ACCESS ── */}
      <section className="py-24 px-12 lg:px-20 border-t border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto">
          <span className="block text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-6">Early Access</span>
          <h2 className="font-serif text-[36px] lg:text-[44px] font-light text-[#0A1628] leading-tight mb-4">
            Be among the first to<br />invest with Tavola AI.
          </h2>
          <p className="text-[14px] text-[#4A5568] mb-8 max-w-sm leading-relaxed">
            Join the waitlist for priority access. No commitment required.
          </p>
          <WaitlistForm />
          {waitlistCount > 0 && (
            <p className="text-[12px] text-[#4A5568] mt-3">
              Join {waitlistCount.toLocaleString()} investors already on the waitlist.
            </p>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0A1628] pt-20 pb-10 px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <span className="font-serif text-[13px] tracking-[0.4em] uppercase text-white/35">
              Tavola
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 pb-16 border-b border-white/10">
            {footerColumns.map(({ heading, links }) => (
              <div key={heading}>
                <div className="text-[10px] tracking-[0.25em] uppercase text-white/25 mb-5">
                  {heading}
                </div>
                <ul className="space-y-3.5">
                  {links.map(({ label, href }) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="text-[11px] text-white/35 hover:text-white/60 transition-colors"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <span className="text-[11px] text-white/20">© 2025 Tavola Financial, Inc.</span>
            <span className="text-[11px] text-white/20">
              Paper trading platform for demonstration purposes only. Not investment advice.
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
