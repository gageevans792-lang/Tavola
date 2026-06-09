import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Tavola',
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

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="text-[13px] text-[#4A5568]">Last updated: {LAST_UPDATED}</p>
        </div>

        {/* NOT investment advice banner */}
        <div className="border border-[#991b1b]/30 bg-[#991b1b]/5 px-6 py-5 mb-10">
          <p className="text-[11px] tracking-[0.18em] uppercase text-[#991b1b] font-medium mb-2">
            Important Disclaimer
          </p>
          <p className="text-[13px] leading-[1.75] text-[#991b1b]/80">
            <strong className="text-[#991b1b]">Tavola does not provide investment advice.</strong>{' '}
            The platform is an AI-powered paper trading tool for educational and entertainment purposes
            only. Nothing on this platform constitutes a recommendation, solicitation, or offer to buy
            or sell any security. All trading during the beta period is simulated — no real money is
            invested. Past performance of any strategy does not guarantee future results. You can lose
            money in real markets.
          </p>
        </div>

        <p className="text-[14px] leading-[1.85] text-[#4A5568] mb-10">
          Please read these Terms of Service (&ldquo;Terms&rdquo;) carefully before using the Tavola
          platform (&ldquo;Service&rdquo;) operated by Tavola (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;) at tavola.ai. By accessing or using the Service, you agree to be bound by
          these Terms. If you do not agree, do not use the Service.
        </p>

        <div className="space-y-8">
          <Section id="acceptance" title="1. Acceptance of Terms">
            <p>
              By creating an account or using any part of the Tavola platform, you represent that you
              have read, understood, and agree to be legally bound by these Terms and our{' '}
              <Link href="/legal/privacy" className="text-[#0A1628] underline underline-offset-2">
                Privacy Policy
              </Link>
              , which is incorporated by reference. If you are using the Service on behalf of an
              organization, you represent that you have the authority to bind that organization to
              these Terms.
            </p>
          </Section>

          <Section id="service" title="2. Description of Service">
            <p>
              Tavola is an AI-powered paper trading platform that provides:
            </p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'Simulated investment portfolio management using artificial intelligence',
                'Paper trading execution through Alpaca Markets (no real money)',
                'AI-generated market analysis, portfolio recommendations, and insights',
                'Portfolio performance tracking and analytics',
                'Market news aggregation and sentiment analysis',
                'AutoPilot automated paper trading based on user-configured parameters',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-[#B8960C] shrink-0 mt-1">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              The Service is provided for educational, research, and entertainment purposes only.
              All trading activity during the beta period occurs in a simulated environment. No real
              securities are purchased or sold on your behalf.
            </p>
          </Section>

          <Section id="not-advice" title="3. Not Investment Advice">
            <p className="font-medium text-[#0A1628]">
              TAVOLA IS NOT A REGISTERED INVESTMENT ADVISER, BROKER-DEALER, FINANCIAL PLANNER, OR
              ANY OTHER TYPE OF FINANCIAL PROFESSIONAL.
            </p>
            <p>
              Nothing on the platform — including AI-generated recommendations, portfolio analysis,
              sentiment scores, earnings intelligence, or any other content — constitutes investment
              advice, financial advice, trading advice, or any other type of advice. You should not
              treat any content on this platform as such.
            </p>
            <p>
              Before making any real investment decision, you should consult a qualified financial
              professional who is familiar with your specific financial situation, goals, and risk
              tolerance.
            </p>
            <p>
              AI-generated content is produced by a language model (Claude, by Anthropic) and may
              contain errors, omissions, or outdated information. The AI does not have access to
              real-time market data beyond what is provided to it via third-party APIs, and its
              analysis may be incorrect or incomplete.
            </p>
          </Section>

          <Section id="paper-trading" title="4. Paper Trading Only">
            <p>
              During the beta period, <span className="font-medium text-[#0A1628]">all accounts on Tavola are paper trading accounts</span>.
              This means:
            </p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'No real money is deposited, transferred, or invested through the platform.',
                'Any balance shown in your account represents simulated funds only.',
                'Trades executed through the platform do not involve real securities or real money.',
                'Portfolio values, gains, and losses are entirely simulated.',
                'Deposits initiated through the platform are simulated and do not result in real ACH transfers.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-[#B8960C] shrink-0 mt-1">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              We will provide clear notice before transitioning any account to real-money trading.
              Real-money accounts will be subject to additional terms, regulatory compliance, and
              verification requirements.
            </p>
          </Section>

          <Section id="eligibility" title="5. User Eligibility">
            <p>To use the Service, you must:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'Be at least 18 years of age.',
                'Be a resident of the United States.',
                'Have the legal capacity to enter into binding contracts.',
                'Not be prohibited from using the Service under any applicable law.',
                'Provide accurate, current, and complete registration information.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-[#B8960C] shrink-0 mt-1">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              We reserve the right to terminate accounts and refuse service to anyone at our sole
              discretion, with or without notice.
            </p>
          </Section>

          <Section id="prohibited" title="6. Prohibited Uses">
            <p>You agree not to:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'Use the Service for any unlawful purpose or in violation of any applicable laws.',
                'Attempt to gain unauthorized access to any portion of the Service or its related systems.',
                'Reverse engineer, decompile, or disassemble any part of the platform.',
                'Use automated bots, scrapers, or crawlers to access the Service without permission.',
                'Impersonate any person or entity or misrepresent your affiliation.',
                'Transmit malware, viruses, or any other malicious code.',
                'Use the Service in any manner that could disable, overburden, or impair servers or networks.',
                'Resell, sublicense, or commercially exploit any portion of the Service without authorization.',
                'Manipulate or interfere with security features or authentication mechanisms.',
                'Use AI-generated recommendations to make real investment decisions without independent verification.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-[#991b1b] shrink-0 mt-1">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="ai-limitations" title="7. AI Limitations and Risk Disclosure">
            <p className="font-medium text-[#0A1628]">
              Investing involves risk. You can lose money.
            </p>
            <p>
              AI-generated investment recommendations on this platform are produced by a large language
              model and carry significant limitations:
            </p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'Recommendations are not guaranteed to be accurate, complete, or suitable for any individual.',
                'Past performance of any strategy, backtested or simulated, does not predict future results.',
                'The AI may make systematic errors, be subject to hallucinations, or produce recommendations based on outdated information.',
                'Market conditions can change rapidly in ways that invalidate any recommendation.',
                'AI models cannot account for your full financial situation, tax position, or risk tolerance.',
                'AutoPilot executes trades automatically based on AI decisions — automated trading carries additional risks.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-[#991b1b] shrink-0 mt-1">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              By using this platform, you acknowledge these limitations and agree that any real
              investment decisions you make based on platform content are entirely your own responsibility.
            </p>
          </Section>

          <Section id="accounts" title="8. User Accounts">
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and
              for all activity that occurs under your account. You must notify us immediately at{' '}
              <span className="text-[#0A1628]">legal@tavola.ai</span> if you suspect unauthorized
              access to your account.
            </p>
            <p>
              You may not share your account credentials with others or create multiple accounts to
              circumvent any restrictions or limitations.
            </p>
          </Section>

          <Section id="ip" title="9. Intellectual Property">
            <p>
              The Tavola platform, including its design, code, AI prompts, analysis frameworks,
              branding, and content, is owned by Tavola and protected by applicable intellectual
              property laws. You are granted a limited, non-exclusive, non-transferable license to
              access and use the Service for personal, non-commercial purposes.
            </p>
            <p>
              You retain ownership of any content you submit to the platform (e.g., watchlist tickers,
              notes). By submitting content, you grant us a license to use it for operating and
              improving the Service.
            </p>
          </Section>

          <Section id="third-party" title="10. Third-Party Services">
            <p>
              The Service integrates with third-party services including Alpaca Markets (paper trading
              execution), Supabase (data storage), Stripe (payments), Finnhub (market data), and
              Anthropic (AI). These services are governed by their own terms and privacy policies.
              We are not responsible for the accuracy of data provided by these services or for their
              availability.
            </p>
            <p>
              Market data provided through Finnhub and Alpaca may be delayed, inaccurate, or
              unavailable. We make no representations about the accuracy of any market data displayed
              on the platform.
            </p>
          </Section>

          <Section id="liability" title="11. Limitation of Liability">
            <p className="font-medium text-[#0A1628]">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, TAVOLA AND ITS OFFICERS, DIRECTORS,
              EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA,
              GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
            <p>
              Our total liability to you for any claim arising out of or relating to these Terms or
              the Service shall not exceed the amount you paid to us in the 12 months preceding the
              claim, or $100, whichever is greater.
            </p>
            <p>
              Some jurisdictions do not allow limitation of liability for certain types of damages.
              In such jurisdictions, our liability is limited to the greatest extent permitted by law.
            </p>
          </Section>

          <Section id="disclaimer" title="12. Disclaimer of Warranties">
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, OR NON-INFRINGEMENT.
            </p>
            <p>
              We do not warrant that the Service will be uninterrupted, error-free, or free of viruses
              or other harmful components. We do not warrant the accuracy of any AI-generated content,
              market data, or investment information provided through the platform.
            </p>
          </Section>

          <Section id="arbitration" title="13. Dispute Resolution and Arbitration">
            <p>
              Any dispute, claim, or controversy arising out of or relating to these Terms or the
              Service shall be resolved by binding arbitration administered by JAMS under its
              Streamlined Arbitration Rules and Procedures, except that either party may seek
              injunctive or other equitable relief in a court of competent jurisdiction to prevent
              the actual or threatened infringement of intellectual property rights.
            </p>
            <p>
              <span className="font-medium text-[#0A1628]">Class Action Waiver:</span> You agree that
              any arbitration or proceeding shall be limited to the dispute between us and you
              individually. You waive any right to participate in a class action lawsuit or
              class-wide arbitration.
            </p>
            <p>
              You have the right to opt out of this arbitration agreement by sending written notice
              to <span className="text-[#0A1628]">legal@tavola.ai</span> within 30 days of first
              accepting these Terms.
            </p>
          </Section>

          <Section id="governing-law" title="14. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the
              State of <span className="font-medium text-[#0A1628]">Florida</span>, without regard
              to its conflict of law provisions. Any disputes not subject to arbitration shall be
              brought exclusively in the state or federal courts located in Florida.
            </p>
          </Section>

          <Section id="changes" title="15. Changes to Terms">
            <p>
              We reserve the right to modify these Terms at any time. Material changes will be
              communicated via email or a prominent notice in the platform at least 14 days before
              taking effect. Your continued use of the Service after changes become effective
              constitutes acceptance of the revised Terms.
            </p>
            <p>
              If you do not agree to the revised Terms, you must stop using the Service and may
              request deletion of your account.
            </p>
          </Section>

          <Section id="termination" title="16. Termination">
            <p>
              We may terminate or suspend your account and access to the Service immediately, without
              prior notice or liability, for any reason, including if you breach these Terms. Upon
              termination, your right to use the Service will immediately cease.
            </p>
            <p>
              You may terminate your account at any time by contacting us at{' '}
              <span className="text-[#0A1628]">legal@tavola.ai</span>. Termination does not affect
              any rights or obligations incurred prior to termination.
            </p>
          </Section>

          <Section id="contact" title="17. Contact">
            <p>
              For questions about these Terms, contact us at:
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
            <Link href="/legal/terms" className="text-[#0A1628] font-medium">
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
