import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security | Tavola',
  description: 'How Tavola protects your data and account with enterprise-grade security.',
};

const sections = [
  {
    title: 'Data Encryption',
    content: 'All data in transit is encrypted with TLS 1.3. Sensitive fields at rest are encrypted using AES-256-GCM with keys derived from a secure server-side secret. We never store raw API keys or secrets in your browser.',
  },
  {
    title: 'Row-Level Security',
    content: 'Our database enforces Row-Level Security (RLS) on every table. Even if a request bypasses application logic, the database itself ensures you can only read and write your own data. No user can ever access another user\'s portfolio, trades, or personal information.',
  },
  {
    title: 'Paper Trading Beta',
    content: 'Tavola is currently in paper-trading beta mode. No real money is connected to the platform. All trades are simulated using Alpaca\'s paper trading environment. You cannot lose real money during this period.',
  },
  {
    title: 'Alpaca Custody',
    content: 'When we launch with real money, your investments will be held by Alpaca Securities LLC, an SEC-registered broker-dealer and FINRA member. Accounts will be protected by SIPC up to $500,000 (including $250,000 for cash claims). This is planned for future launch and is not currently active.',
  },
  {
    title: 'Authentication',
    content: 'Authentication is powered by Supabase Auth, which uses industry-standard JWT tokens with short expiry windows. We support secure session management with automatic token rotation. All authentication events are audit-logged.',
  },
  {
    title: 'AI Data Processing',
    content: 'Portfolio analysis requests are processed by Anthropic\'s Claude AI. Only anonymized portfolio snapshots (positions and values, not personal identity) are sent for analysis. We do not share your personal information with AI providers beyond what is necessary to generate analysis.',
  },
  {
    title: 'Audit Logging',
    content: 'All significant account actions — trades, deposits, withdrawals, strategy changes — are written to an immutable audit log. This provides a complete, tamper-resistant record of account activity.',
  },
  {
    title: 'Responsible Disclosure',
    content: 'Found a security vulnerability? Please report it to security@tavola.app. We take all reports seriously and will respond within 48 hours. We ask that you do not publicly disclose vulnerabilities until we have had time to address them.',
  },
];

export default function SecurityPage() {
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
        <section className="py-16 sm:py-24 px-6 text-center border-b border-[#E2E8F0]">
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-6">Security</p>
          <h1 className="font-serif text-[40px] sm:text-[56px] font-light text-[#0A1628] leading-tight mb-6">
            Built on trust.
          </h1>
          <p className="text-[16px] text-[#4A5568] max-w-xl mx-auto leading-relaxed">
            Enterprise-grade security for every account, from day one.
          </p>
        </section>

        {/* Beta notice */}
        <div className="bg-[#991b1b]/5 border-b border-[#991b1b]/20 px-6 py-4">
          <p className="max-w-4xl mx-auto text-center text-[13px] text-[#991b1b]">
            <strong>Beta Notice:</strong> Tavola currently operates in paper-trading mode only. No real money is connected to the platform.
          </p>
        </div>

        {/* Trust badges */}
        <section className="border-b border-[#E2E8F0] py-8 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border border-[#E2E8F0] bg-[#E2E8F0]">
              {[
                { label: 'Encryption', value: 'AES-256' },
                { label: 'Transport', value: 'TLS 1.3' },
                { label: 'Database', value: 'RLS Enforced' },
                { label: 'Auth', value: 'JWT + Rotation' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white px-5 py-5 text-center">
                  <p className="text-[10px] tracking-[0.18em] uppercase text-[#4A5568] mb-2">{label}</p>
                  <p className="font-serif text-[18px] font-light text-[#0A1628]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Content sections */}
        <section className="py-12 sm:py-16 px-6">
          <div className="max-w-3xl mx-auto space-y-0">
            {sections.map((s, i) => (
              <div key={i} className="border-b border-[#E2E8F0] py-8 last:border-b-0">
                <h2 className="font-serif text-[20px] sm:text-[24px] font-light text-[#0A1628] mb-4">
                  {s.title}
                </h2>
                <p className="text-[14px] sm:text-[15px] text-[#4A5568] leading-relaxed">
                  {s.content}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="py-16 px-6 bg-[#F8F9FA] border-t border-[#E2E8F0] text-center">
          <h2 className="font-serif text-[28px] font-light text-[#0A1628] mb-4">
            Questions about security?
          </h2>
          <p className="text-[14px] text-[#4A5568] mb-6">
            Contact our security team at{' '}
            <a href="mailto:security@tavola.app" className="text-[#B8960C] hover:underline">
              security@tavola.app
            </a>
          </p>
          <Link
            href="/"
            className="inline-block border border-[#E2E8F0] text-[#0A1628] text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:border-[#0A1628] transition-colors"
          >
            Back to Home
          </Link>
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
            <Link href="/how-it-works" className="text-[11px] text-[#4A5568] hover:text-[#0A1628] transition-colors">How It Works</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
