'use client';

export default function GlobalError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'sans-serif', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '24px' }}>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#991b1b', marginBottom: '16px' }}>
            Critical Error
          </p>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '42px', fontWeight: 300, color: '#0A1628', marginBottom: '16px', lineHeight: 1 }}>
            Tavola is temporarily unavailable
          </h1>
          <p style={{ color: '#4A5568', marginBottom: '32px', maxWidth: '400px' }}>
            We apologize for the inconvenience. Please refresh the page or try again shortly.
          </p>
          <button onClick={unstable_retry} style={{ background: '#0A1628', color: '#fff', border: 'none', padding: '12px 32px', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
      </body>
    </html>
  );
}
