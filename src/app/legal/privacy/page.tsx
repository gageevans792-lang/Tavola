import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Tavola',
};

const LAST_UPDATED = 'June 2025';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-t border-[#E2E8F0] pt-10 pb-4">
      <h2 className="font-serif text-[22px] font-light text-[#0A1628] mb-5">{title}</h2>
      <div className="space-y-4 text-[14px] leading-[1.85] text-[#4A5568]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
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
          href="/legal"
          className="text-[11px] tracking-[0.12em] uppercase text-[#4A5568] hover:text-[#0A1628] transition-colors"
        >
          ← Legal
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-8 lg:px-0 py-16">
        {/* Page title */}
        <div className="mb-12 pb-10 border-b border-[#E2E8F0]">
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-4">Legal</p>
          <h1 className="font-serif text-[42px] font-light text-[#0A1628] leading-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-[13px] text-[#4A5568]">Last updated: {LAST_UPDATED}</p>
        </div>

        {/* Intro */}
        <p className="text-[14px] leading-[1.85] text-[#4A5568] mb-10">
          Tavola (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the Tavola AI Investment Platform at{' '}
          <span className="text-[#0A1628]">tavola.ai</span>. This Privacy Policy explains how we collect,
          use, disclose, and protect your personal information when you use our platform. By using Tavola,
          you agree to the practices described in this policy.
        </p>

        <div className="space-y-8">
          <Section id="collect" title="1. Information We Collect">
            <p>We collect the following categories of information:</p>
            <div className="space-y-3 mt-2">
              <div className="pl-4 border-l-2 border-[#E2E8F0]">
                <p className="font-medium text-[#0A1628] mb-1">Account Information</p>
                <p>
                  Your name and email address, collected at registration. Password is hashed and never
                  stored in plaintext.
                </p>
              </div>
              <div className="pl-4 border-l-2 border-[#E2E8F0]">
                <p className="font-medium text-[#0A1628] mb-1">Financial Profile</p>
                <p>
                  Investment goals, risk tolerance profile (conservative, balanced, growth, or
                  aggressive), and investment preferences you provide during onboarding or settings updates.
                </p>
              </div>
              <div className="pl-4 border-l-2 border-[#E2E8F0]">
                <p className="font-medium text-[#0A1628] mb-1">Portfolio and Trading Data</p>
                <p>
                  Holdings, watchlist tickers, trade history, AI-generated recommendations you accept or
                  reject, and AutoPilot configuration. This data is linked to your paper trading account
                  via Alpaca Markets.
                </p>
              </div>
              <div className="pl-4 border-l-2 border-[#E2E8F0]">
                <p className="font-medium text-[#0A1628] mb-1">Usage Data</p>
                <p>
                  Pages visited, features used, session duration, browser type, device type, IP address,
                  and interaction logs. This data helps us improve the platform.
                </p>
              </div>
              <div className="pl-4 border-l-2 border-[#E2E8F0]">
                <p className="font-medium text-[#0A1628] mb-1">Payment Information</p>
                <p>
                  If you subscribe to a paid plan, payment processing is handled entirely by Stripe. We do
                  not store credit card numbers, CVVs, or full bank account details on our servers.
                </p>
              </div>
              <div className="pl-4 border-l-2 border-[#E2E8F0]">
                <p className="font-medium text-[#0A1628] mb-1">Communications</p>
                <p>
                  Any messages you send to our support team or through in-app chat features.
                </p>
              </div>
            </div>
          </Section>

          <Section id="use" title="2. How We Use Your Information">
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'To provide, operate, and maintain the Tavola platform and your account.',
                'To generate personalized AI investment recommendations tailored to your risk profile and goals.',
                'To execute paper trades on your behalf through Alpaca Markets when AutoPilot is enabled.',
                'To analyze portfolio performance and generate insights and intelligence reports.',
                'To process subscription payments through Stripe.',
                'To send account-related notifications, security alerts, and service updates.',
                'To improve our AI models, recommendation quality, and platform features.',
                'To detect and prevent fraud, abuse, and unauthorized access.',
                'To comply with applicable laws and legal obligations.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-[#B8960C] shrink-0 mt-1">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="ai" title="3. AI and Automated Decision Making">
            <p>
              Tavola uses <span className="text-[#0A1628] font-medium">Claude AI</span>, developed by
              Anthropic, PBC, to generate investment recommendations, portfolio analysis, and market
              commentary. When you request an analysis or enable AutoPilot, your portfolio data
              (holdings, watchlist, account balances) is transmitted to Anthropic&apos;s API to generate a
              response.
            </p>
            <p>
              No personally identifiable information beyond what is necessary for portfolio analysis
              (tickers, quantities, market values) is included in prompts sent to Claude. Your name,
              email, and payment information are never transmitted to Anthropic.
            </p>
            <p>
              <span className="font-medium text-[#0A1628]">Important:</span> AI-generated recommendations
              are not financial advice. They are generated by a language model and may be inaccurate,
              incomplete, or inappropriate for your specific circumstances. All investment decisions
              remain your responsibility.
            </p>
            <p>
              During the beta period, all trades executed through AutoPilot or manual execution are
              paper trades. No real money is at risk. Anthropic&apos;s data usage policies can be reviewed at{' '}
              <span className="text-[#0A1628]">anthropic.com/privacy</span>.
            </p>
          </Section>

          <Section id="third-party" title="4. Third-Party Services">
            <p>We share your data with the following trusted service providers, solely to operate the platform:</p>
            <div className="space-y-4 mt-2">
              {[
                {
                  name: 'Supabase',
                  role: 'Database and Authentication',
                  detail:
                    'Your account data, portfolio holdings, watchlists, trade history, and AI insights are stored in Supabase. Row-Level Security (RLS) ensures each user can only access their own data.',
                },
                {
                  name: 'Alpaca Markets',
                  role: 'Brokerage and Trading',
                  detail:
                    'Your paper trading account is held at Alpaca Markets. Portfolio positions, account balances, and order history are synced from Alpaca\'s API. During beta, all accounts are paper trading accounts only.',
                },
                {
                  name: 'Stripe',
                  role: 'Payment Processing',
                  detail:
                    'Subscription billing is processed by Stripe. Stripe stores your payment method details under their own privacy policy. We receive only a customer ID and subscription status.',
                },
                {
                  name: 'Finnhub',
                  role: 'Market Data',
                  detail:
                    'Market news, insider transactions, analyst recommendations, and earnings data are fetched from Finnhub\'s API. Your ticker watchlist may be used as query parameters in these requests.',
                },
                {
                  name: 'Anthropic',
                  role: 'AI Analysis (Claude)',
                  detail:
                    'Portfolio snapshots (tickers, quantities, values) are sent to Anthropic\'s Claude API to generate investment analysis. No personal identifiers are included in these requests.',
                },
              ].map(({ name, role, detail }) => (
                <div key={name} className="pl-4 border-l-2 border-[#E2E8F0]">
                  <p className="font-medium text-[#0A1628] mb-0.5">
                    {name}<span className="font-normal text-[#4A5568]">, {role}</span>
                  </p>
                  <p>{detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-4">
              We do not sell your personal information to any third party. We do not use your data for
              targeted advertising.
            </p>
          </Section>

          <Section id="security" title="5. Data Security">
            <p>
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'All data is transmitted over HTTPS with TLS 1.2+ encryption.',
                'Passwords are hashed using bcrypt and never stored in plaintext.',
                'Supabase Row-Level Security (RLS) ensures database isolation. Your data is never accessible to other users.',
                'API keys for third-party services (Alpaca, Finnhub, Anthropic) are stored as server-side environment variables and never exposed to the browser.',
                'Stripe handles payment data under PCI-DSS Level 1 compliance.',
                'Access to production systems is restricted to authorized personnel only.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-[#B8960C] shrink-0 mt-1">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              No method of electronic transmission or storage is 100% secure. While we strive to
              protect your data, we cannot guarantee absolute security.
            </p>
          </Section>

          <Section id="retention" title="6. Data Retention">
            <p>
              We retain your account data for as long as your account is active. If you delete your
              account, we will delete or anonymize your personal information within 30 days, except
              where retention is required by applicable law.
            </p>
            <p>
              Trade history and audit logs may be retained for up to 7 years for compliance purposes,
              even after account deletion, in anonymized form.
            </p>
          </Section>

          <Section id="rights" title="7. Your Rights">
            <p>
              Depending on your jurisdiction, you may have the following rights regarding your personal
              information:
            </p>
            <div className="space-y-3 mt-2">
              {[
                {
                  right: 'Access',
                  desc: 'Request a copy of the personal information we hold about you.',
                },
                {
                  right: 'Correction',
                  desc: 'Request correction of inaccurate or incomplete information. Most account data can be updated directly in Settings.',
                },
                {
                  right: 'Deletion',
                  desc: 'Request deletion of your account and associated personal data. Email legal@tavola.ai to submit a deletion request.',
                },
                {
                  right: 'Portability',
                  desc: 'Request an export of your data in a machine-readable format.',
                },
                {
                  right: 'Opt-out',
                  desc: 'Opt out of non-essential communications at any time via account settings or unsubscribe links.',
                },
              ].map(({ right, desc }) => (
                <div key={right} className="pl-4 border-l-2 border-[#E2E8F0]">
                  <p>
                    <span className="font-medium text-[#0A1628]">{right}:</span> {desc}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4">
              To exercise any of these rights, contact us at{' '}
              <span className="text-[#0A1628] font-medium">legal@tavola.ai</span>.
            </p>
          </Section>

          <Section id="paper-trading" title="8. Paper Trading Disclaimer">
            <p>
              Tavola currently operates in <span className="font-medium text-[#0A1628]">paper trading mode only</span>.
              This means:
            </p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'No real money is deposited, invested, or withdrawn during the beta period.',
                'Any "deposits" shown in the platform are simulated for demonstration purposes.',
                'Trades executed through the platform do not involve real securities.',
                'Performance results displayed are simulated and do not represent actual investment returns.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-[#B8960C] shrink-0 mt-1">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              When Tavola launches real-money accounts, this Privacy Policy will be updated accordingly,
              and you will be notified before any real-money functionality is enabled on your account.
            </p>
          </Section>

          <Section id="cookies" title="9. Cookies and Tracking">
            <p>
              Tavola uses essential session cookies to maintain your logged-in state. We do not use
              third-party advertising cookies or cross-site tracking cookies.
            </p>
            <p>
              We may use anonymized analytics to understand how users interact with the platform
              (e.g., which pages are most visited). No personally identifiable information is included
              in analytics data.
            </p>
          </Section>

          <Section id="children" title="10. Children's Privacy">
            <p>
              Tavola is not directed to individuals under the age of 18. We do not knowingly collect
              personal information from children. If you believe we have inadvertently collected
              information from a minor, contact us at{' '}
              <span className="text-[#0A1628] font-medium">legal@tavola.ai</span> and we will promptly
              delete it.
            </p>
          </Section>

          <Section id="changes" title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated
              via email or a prominent notice within the platform at least 14 days before taking effect.
              Continued use of the platform after changes constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section id="contact" title="12. Contact Us">
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy or your
              personal data, contact us at:
            </p>
            <div className="mt-4 pl-4 border-l-2 border-[#B8960C]">
              <p className="font-medium text-[#0A1628]">Tavola</p>
              <p>Email: <span className="text-[#0A1628]">legal@tavola.ai</span></p>
              <p>Website: <span className="text-[#0A1628]">tavola.ai</span></p>
            </div>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] mt-16 px-8 lg:px-16 py-8">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-[11px] text-[#4A5568]">© 2025 Tavola · Paper Trading Beta</span>
          <div className="flex items-center gap-6 text-[11px]">
            <Link href="/legal/terms" className="text-[#4A5568] hover:text-[#0A1628] transition-colors">
              Terms of Service
            </Link>
            <Link href="/legal/privacy" className="text-[#0A1628] font-medium">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
