import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6">
      <p className="font-serif text-[120px] lg:text-[160px] font-light leading-none mb-0"
        style={{ color: '#B8960C', opacity: 0.15 }}>
        404
      </p>
      <div className="-mt-4 lg:-mt-8 mb-6">
        <p className="text-[10px] tracking-[0.35em] uppercase text-[#B8960C] mb-4">Page Not Found</p>
        <h1 className="font-serif text-[32px] lg:text-[44px] font-light text-[#0A1628] leading-tight">
          This page doesn't exist.
        </h1>
      </div>
      <p className="text-[15px] text-[#4A5568] max-w-sm mb-10 leading-relaxed">
        The page you're looking for has been moved, deleted, or never existed.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link
          href="/dashboard"
          className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:bg-[#162035] transition-colors"
        >
          Return to Dashboard
        </Link>
        <Link
          href="/"
          className="border border-[#E2E8F0] text-[#0A1628] text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:border-[#0A1628] transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
