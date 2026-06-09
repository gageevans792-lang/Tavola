import Link from 'next/link';

export const metadata = {
  title: 'Legal — Tavola',
};

const documents = [
  {
    href:     '/legal/privacy',
    label:    'Privacy Policy',
    updated:  'June 2025',
    desc:     'How we collect, use, and protect your personal data. Covers AI processing, third-party services, your rights, and our paper trading data practices.',
  },
  {
    href:     '/legal/terms',
    label:    'Terms of Service',
    updated:  'June 2025',
    desc:     'Conditions governing your use of the platform. Includes the paper trading disclaimer, AI limitations, risk disclosure, and dispute resolution.',
  },
];

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-white text-[#0A1628]">
      {/* Header */}
      <header className="border-b border-[#E2E8F0] px-8 lg:px-16 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-serif text-[13px] tracking-[0.4em] uppercase text-[#0A1628] hover:text-[#0A1628]/70 transition-colors"
        >
          Tavola
        </Link>
        <Link
          href="/"
          className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors"
        >
          ← Home
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-8 lg:px-0 py-20">
        <div className="mb-14">
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-4">Legal</p>
          <h1 className="font-serif text-[42px] font-light text-[#0A1628] leading-tight">
            Legal Documents
          </h1>
        </div>

        <div className="space-y-0">
          {documents.map(({ href, label, updated, desc }) => (
            <Link
              key={href}
              href={href}
              className="group block border-t border-[#E2E8F0] py-8 hover:bg-[#F8F9FA] -mx-6 px-6 transition-colors"
            >
              <div className="flex items-start justify-between gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-serif text-[22px] font-light text-[#0A1628] group-hover:text-[#B8960C] transition-colors">
                      {label}
                    </h2>
                    <span className="text-[10px] tracking-[0.12em] uppercase text-[#4A5568]/50">
                      Updated {updated}
                    </span>
                  </div>
                  <p className="text-[13px] leading-[1.75] text-[#4A5568] max-w-xl">{desc}</p>
                </div>
                <span className="text-[#4A5568]/40 group-hover:text-[#B8960C] transition-colors mt-1 shrink-0 text-lg">
                  →
                </span>
              </div>
            </Link>
          ))}
          <div className="border-t border-[#E2E8F0]" />
        </div>

        <div className="mt-14 pt-10 border-t border-[#E2E8F0]">
          <p className="text-[13px] leading-[1.85] text-[#4A5568]">
            Questions about our legal policies? Contact us at{' '}
            <span className="text-[#0A1628] font-medium">legal@tavola.ai</span>.
          </p>
          <p className="mt-3 text-[12px] text-[#4A5568]/60">
            Tavola is a paper trading platform for educational purposes. Not investment advice.
            All trading during the beta period is simulated — no real money is involved.
          </p>
        </div>
      </main>

      <footer className="border-t border-[#E2E8F0] mt-8 px-8 lg:px-16 py-8">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-[11px] text-[#4A5568]">© 2025 Tavola · Paper Trading Beta</span>
          <div className="flex items-center gap-6 text-[11px]">
            <Link href="/legal/terms" className="text-[#4A5568] hover:text-[#0A1628] transition-colors">
              Terms of Service
            </Link>
            <Link href="/legal/privacy" className="text-[#4A5568] hover:text-[#0A1628] transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
