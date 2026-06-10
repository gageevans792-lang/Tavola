import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works | Tavola',
  description: 'Learn how Tavola\'s AI-powered investment platform works in four simple steps.',
};

const steps = [
  {
    number: '01',
    title: 'Open Your Account',
    description: 'Create your account and complete onboarding in under 5 minutes. Tell us your investment goals and risk tolerance. We use this to personalize your entire AI strategy.',
  },
  {
    number: '02',
    title: 'AI Builds Your Plan',
    description: 'Our AI analyzes thousands of data points: market sentiment, earnings calendars, macro indicators, and your specific goals. It generates a personalized portfolio strategy and specific trade recommendations.',
  },
  {
    number: '03',
    title: 'AutoPilot Manages',
    description: 'With AutoPilot enabled, Tavola automatically executes approved trades, rebalances your portfolio, and monitors positions 24/7. Every decision is logged with reasoning you can review.',
  },
  {
    number: '04',
    title: 'You Watch It Grow',
    description: 'Track performance, review AI reasoning, and adjust your strategy at any time. Full transparency into every decision, every trade, every day.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif text-[20px] text-[#0A1628] tracking-wide">
            TAVOLA
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-[12px] tracking-[0.15em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase px-5 py-2.5 hover:bg-[#162035] transition-colors">
              Open Account
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-16">
        {/* Header */}
        <section className="py-20 sm:py-28 px-6 text-center border-b border-[#E2E8F0]">
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-6">The Process</p>
          <h1 className="font-serif text-[40px] sm:text-[56px] lg:text-[72px] font-light text-[#0A1628] leading-tight mb-6">
            How Tavola Works
          </h1>
          <p className="text-[16px] sm:text-[18px] text-[#4A5568] max-w-xl mx-auto leading-relaxed">
            AI-powered investing, explained in four steps.
          </p>
        </section>

        {/* Beta disclaimer */}
        <div className="bg-[#991b1b]/5 border-b border-[#991b1b]/20 px-6 py-4">
          <p className="max-w-4xl mx-auto text-center text-[13px] text-[#991b1b]">
            <strong>Beta Notice:</strong> Tavola currently operates in paper-trading mode. No real money is at risk during the beta period.
          </p>
        </div>

        {/* Steps */}
        <section className="py-20 sm:py-28 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-0">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-6 sm:gap-12 py-12 sm:py-16 border-b border-[#E2E8F0] last:border-b-0"
                >
                  <div className="flex sm:flex-col sm:items-start items-center gap-4 sm:gap-0">
                    <span className="font-serif text-[56px] sm:text-[72px] font-light leading-none text-[#B8960C] opacity-30">
                      {step.number}
                    </span>
                  </div>
                  <div className="flex flex-col justify-center">
                    <h2 className="font-serif text-[24px] sm:text-[32px] font-light text-[#0A1628] mb-4 leading-tight">
                      {step.title}
                    </h2>
                    <p className="text-[15px] sm:text-[16px] text-[#4A5568] leading-relaxed max-w-lg">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-6 bg-[#0A1628] text-center">
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-6">Get Started</p>
          <h2 className="font-serif text-[36px] sm:text-[48px] font-light text-white mb-6 leading-tight">
            Ready to get started?
          </h2>
          <p className="text-[15px] text-white/60 mb-10 max-w-sm mx-auto">
            Join thousands of investors using AI to grow their wealth.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="bg-[#B8960C] text-white text-[11px] tracking-[0.2em] uppercase px-10 py-4 hover:bg-[#9a7d0a] transition-colors"
            >
              Open Account
            </Link>
            <Link
              href="/about"
              className="border border-white/30 text-white text-[11px] tracking-[0.2em] uppercase px-10 py-4 hover:border-white/60 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-[#4A5568]">
            &copy; {new Date().getFullYear()} Tavola. Paper trading beta.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/legal/terms" className="text-[11px] text-[#4A5568] hover:text-[#0A1628] transition-colors">Terms</Link>
            <Link href="/legal/privacy" className="text-[11px] text-[#4A5568] hover:text-[#0A1628] transition-colors">Privacy</Link>
            <Link href="/security" className="text-[11px] text-[#4A5568] hover:text-[#0A1628] transition-colors">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
