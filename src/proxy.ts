import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PUBLIC_ROUTES = new Set(['/', '/login', '/signup', '/onboarding']);
const PUBLIC_PREFIXES = ['/api/stripe/webhook', '/_next', '/favicon.ico'];

/** Auth-sensitive endpoints subject to rate limiting. */
const RATE_LIMITED_ROUTES = ['/api/auth', '/login', '/signup'];

const RATE_LIMIT_MAX = 10;          // requests
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds

const MAX_URL_LENGTH = 2000;

// ---------------------------------------------------------------------------
// In-memory rate-limit store
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/** Remove stale entries to prevent unbounded memory growth. */
function pruneRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Prune every 5 minutes.  Using a module-level timer is safe in the Edge
// runtime because the timer only fires when the module is active.
let pruneTimer: ReturnType<typeof setInterval> | null = null;
if (typeof setInterval !== 'undefined') {
  pruneTimer = setInterval(pruneRateLimitStore, 5 * 60_000);
  // Prevent the timer from keeping a Node.js process alive in tests.
  if (pruneTimer && typeof pruneTimer === 'object' && 'unref' in pruneTimer) {
    (pruneTimer as { unref: () => void }).unref();
  }
}

/**
 * Check whether the IP has exceeded the rate limit.
 * Returns true if the request is allowed, false if it should be rejected.
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetAt < now) {
    // First request in this window (or window expired).
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

/** Seconds until the rate-limit window resets for the given IP. */
function retryAfterSeconds(ip: string): number {
  const entry = rateLimitStore.get(ip);
  if (!entry) return Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
  return Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPublic(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isRateLimited(pathname: string): boolean {
  return RATE_LIMITED_ROUTES.some((route) => pathname.startsWith(route));
}

function getClientIp(request: NextRequest): string {
  // Prefer the standard forwarded-for header populated by proxies/load-balancers.
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for may be a comma-separated list; take the first (leftmost) IP.
    return forwarded.split(',')[0].trim();
  }
  // Fall back to a placeholder when the IP is not available.
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Block overly long URLs ---
  if (request.url.length > MAX_URL_LENGTH) {
    return new NextResponse(
      JSON.stringify({ error: 'URL too long' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': crypto.randomUUID(),
        },
      },
    );
  }

  // --- Block path traversal ---
  if (pathname.includes('/../')) {
    return new NextResponse(
      JSON.stringify({ error: 'Invalid path' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': crypto.randomUUID(),
        },
      },
    );
  }

  // --- Rate limiting for auth endpoints ---
  if (isRateLimited(pathname)) {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      const retryAfter = retryAfterSeconds(ip);
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            'X-Request-ID': crypto.randomUUID(),
          },
        },
      );
    }
  }

  // Build a mutable response so Supabase can refresh the session cookie.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write updated cookies onto both the forwarded request and the response.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() validates the JWT server-side — more secure than getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Attach X-Tavola-User-ID for protected API routes ---
  // API routes can rely on this header to identify the caller without
  // re-validating the JWT through Supabase on every call.
  if (user && pathname.startsWith('/api/') && !isPublic(pathname)) {
    response.headers.set('X-Tavola-User-ID', user.id);
  }

  // Unauthenticated → redirect to /login for any protected route.
  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('X-Request-ID', crypto.randomUUID());
    return redirectResponse;
  }

  // Authenticated → skip the auth pages, send straight to dashboard.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('X-Request-ID', crypto.randomUUID());
    return redirectResponse;
  }

  // --- Attach X-Request-ID to every normal response ---
  response.headers.set('X-Request-ID', crypto.randomUUID());

  return response;
}

export const config = {
  matcher: [
    // Run on every route except static assets and image optimisation.
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
