import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6">
      <p className="text-[10px] tracking-[0.25em] uppercase text-[#B8960C] mb-4">Error 404</p>
      <h1 className="font-serif text-[64px] font-light text-[#0A1628] leading-none mb-4">
        Page Not Found
      </h1>
      <p className="text-[15px] text-[#4A5568] max-w-sm mb-10 leading-relaxed">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="bg-[#0A1628] text-white text-[11px] tracking-[0.2em] uppercase px-8 py-3 hover:bg-[#162035] transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
