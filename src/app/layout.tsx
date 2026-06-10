import type { Metadata } from 'next';
import { Cormorant_Garamond } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cormorant',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://tavola.app'),
  title: {
    default: 'Tavola | AI Investment Platform',
    template: '%s | Tavola',
  },
  description: 'Institutional-grade AI investing, available to everyone. Build a diversified portfolio with Claude AI managing your investments automatically.',
  keywords: ['AI investing', 'automated portfolio', 'ETF investing', 'robo advisor', 'AI portfolio management', 'AutoPilot investing', 'paper trading'],
  openGraph: {
    title: 'Tavola | AI Investment Platform',
    description: 'Institutional-grade AI investing, available to everyone.',
    type: 'website',
    siteName: 'Tavola',
    url: 'https://tavola.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tavola | AI Investment Platform',
    description: 'Institutional-grade AI investing, available to everyone.',
    site: '@tavola_app',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cormorant.variable}>
      <body className="h-full antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
