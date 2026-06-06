import Link from 'next/link';

const tickerItems = [
  'NVDA +184% · Called Jan 2025',
  'TSMC +22% · Called Mar 2025',
  'META +67% · Called Feb 2025',
  'AAPL +45% · Called Dec 2024',
  'MSFT +38% · Called Nov 2024',
  'AMZN +52% · Called Feb 2025',
  'GOOGL +71% · Called Jan 2025',
  'AMD +95% · Called Oct 2024',
];

const stats = [
  { value: '$2.4B', label: 'Assets Under Management' },
  { value: '94.2%', label: 'Win Rate' },
  { value: '82.4%', label: 'Avg Annual Return' },
  { value: '47,000', label: 'Investors' },
];

const steps = [
  {
    number: '01',
    title: 'Deposit funds',
    desc: 'Connect your bank and fund your account in minutes. No minimums required.',
  },
  {
    number: '02',
    title: 'Set your risk profile',
    desc: 'Choose how aggressively you want Tavola AI to invest on your behalf.',
  },
  {
    number: '03',
    title: 'Tavola AI does the rest',
    desc: '24/7 algorithmic trading analyzes markets and executes your strategy.',
  },
];

const riskProfiles = [
  { name: 'Conservative', range: '6–12%', desc: 'Steady growth with capital preservation focus.' },
  { name: 'Balanced', range: '15–25%', desc: 'Moderate risk with diversified AI-selected positions.' },
  { name: 'Growth', range: '30–50%', desc: 'Higher volatility targeting above-market returns.' },
  { name: 'Aggressive', range: '50%+', desc: 'Maximum exposure for experienced investors.' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] text-[#1C1C1E]">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 bg-[#F5F0E8]/90 backdrop-blur-sm border-b border-[#1C1C1E]/10">
        <span className="font-serif text-xl tracking-[0.3em] font-semibold">TAVOLA</span>
        <div className="flex items-center gap-5">
          <Link
            href="/signin"
            className="text-sm tracking-wide text-[#1C1C1E]/60 hover:text-[#1C1C1E] transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="text-sm tracking-widest uppercase bg-[#C9A84C] text-white px-5 py-2.5 hover:bg-[#b8963e] transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="flex flex-col items-center justify-center min-h-screen px-6 pt-20 text-center">
        <h1 className="font-serif text-5xl md:text-7xl font-light leading-[1.1] max-w-4xl mb-6">
          Your money, finally working<br className="hidden md:block" /> as hard as you do.
        </h1>
        <p className="text-lg md:text-xl text-[#1C1C1E]/55 max-w-lg mb-10 leading-relaxed font-light">
          24/7 AI portfolio management that analyzes markets, executes trades,
          and compounds your wealth — while you sleep.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mb-14">
          <Link
            href="/signup"
            className="px-8 py-4 bg-[#C9A84C] text-white text-xs tracking-[0.2em] uppercase hover:bg-[#b8963e] transition-colors"
          >
            Start Investing
          </Link>
          <a
            href="#how-it-works"
            className="px-8 py-4 border border-[#1C1C1E]/25 text-[#1C1C1E] text-xs tracking-[0.2em] uppercase hover:border-[#1C1C1E]/60 transition-colors"
          >
            See How It Works
          </a>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {['AI-Managed', 'SIPC Insured', 'No Minimums'].map((pill) => (
            <span
              key={pill}
              className="text-xs tracking-[0.15em] uppercase px-4 py-2 border border-[#C9A84C]/50 text-[#C9A84C]"
            >
              {pill}
            </span>
          ))}
        </div>
      </section>

      {/* STATS BAR */}
      <section className="bg-[#1C1C1E] py-14 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <div className="font-serif text-3xl md:text-4xl font-light text-[#C9A84C] mb-2">
                {value}
              </div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-white/40">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-4xl font-light text-center mb-20">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-14">
            {steps.map(({ number, title, desc }) => (
              <div key={number} className="flex flex-col">
                <span className="font-serif text-6xl font-light text-[#C9A84C]/25 mb-5 leading-none">
                  {number}
                </span>
                <h3 className="font-serif text-xl mb-3">{title}</h3>
                <p className="text-sm leading-relaxed text-[#1C1C1E]/55">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREDICTION TICKER */}
      <section className="border-y border-[#1C1C1E]/10 py-4 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-3 mx-10 text-sm tracking-wide text-[#1C1C1E]/45"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* RISK PROFILES */}
      <section className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-4xl font-light text-center mb-3">
            Choose Your Risk Profile
          </h2>
          <p className="text-center text-[#1C1C1E]/45 mb-16 text-sm tracking-wide">
            Target annual returns based on your appetite for risk.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-px bg-[#1C1C1E]/10">
            {riskProfiles.map(({ name, range, desc }) => (
              <div
                key={name}
                className="bg-[#F5F0E8] p-8 hover:bg-white hover:shadow-sm transition-all duration-200 cursor-pointer group"
              >
                <div className="font-serif text-2xl font-light text-[#C9A84C] mb-2">{range}</div>
                <div className="font-serif text-lg mb-4">{name}</div>
                <p className="text-xs leading-relaxed text-[#1C1C1E]/50">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#1C1C1E] py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="font-serif text-base tracking-[0.35em] text-white/60">TAVOLA</span>
          <p className="text-xs text-center max-w-sm leading-relaxed text-white/30">
            For paper trading and educational purposes only. Not a registered investment
            advisor. All returns are simulated. Past performance does not guarantee future results.
          </p>
          <span className="text-xs text-white/30">© 2025 Tavola</span>
        </div>
      </footer>

    </div>
  );
}
