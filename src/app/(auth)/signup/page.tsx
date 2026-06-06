import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-white text-[#0A1628] flex flex-col">

      {/* Wordmark */}
      <div className="px-12 lg:px-20 h-14 flex items-center border-b border-[#E2E8F0] shrink-0">
        <Link
          href="/"
          className="font-serif text-[13px] tracking-[0.4em] uppercase text-[#0A1628]"
        >
          Tavola
        </Link>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-[380px]">

          <div className="mb-12">
            <h1 className="font-serif text-[36px] font-light text-[#0A1628] leading-tight mb-3">
              Open your account
            </h1>
            <p className="text-[14px] text-[#0A1628]/50 leading-relaxed">
              Institutional-grade AI investing, available to everyone.
            </p>
          </div>

          <form className="space-y-9">
            <div>
              <label className="block text-[11px] tracking-[0.2em] uppercase text-[#0A1628]/40 mb-3">
                Full Name
              </label>
              <input
                type="text"
                required
                className="block w-full border-0 border-b border-[#E2E8F0] pb-3 text-[14px] text-[#0A1628] bg-transparent focus:outline-none focus:border-[#0A1628] transition-colors placeholder:text-[#0A1628]/20"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-[11px] tracking-[0.2em] uppercase text-[#0A1628]/40 mb-3">
                Email
              </label>
              <input
                type="email"
                required
                className="block w-full border-0 border-b border-[#E2E8F0] pb-3 text-[14px] text-[#0A1628] bg-transparent focus:outline-none focus:border-[#0A1628] transition-colors placeholder:text-[#0A1628]/20"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] tracking-[0.2em] uppercase text-[#0A1628]/40 mb-3">
                Password
              </label>
              <input
                type="password"
                required
                className="block w-full border-0 border-b border-[#E2E8F0] pb-3 text-[14px] text-[#0A1628] bg-transparent focus:outline-none focus:border-[#0A1628] transition-colors placeholder:text-[#0A1628]/20"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="w-full h-12 bg-[#0A1628] text-white text-[12px] tracking-[0.2em] uppercase hover:bg-[#0A1628]/85 transition-colors"
              >
                Create Account
              </button>
            </div>
          </form>

          <p className="mt-8 text-[12px] text-[#0A1628]/50">
            Already have an account?{' '}
            <Link href="/login" className="text-[#0A1628] hover:underline underline-offset-2">
              Sign in →
            </Link>
          </p>

        </div>
      </div>

      {/* Legal */}
      <div className="px-6 pb-8 text-center shrink-0">
        <p className="text-[10px] text-[#0A1628]/30 leading-relaxed max-w-sm mx-auto">
          By creating an account you agree to our{' '}
          <Link href="#" className="hover:text-[#0A1628]/50 transition-colors">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="#" className="hover:text-[#0A1628]/50 transition-colors">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

    </div>
  );
}
