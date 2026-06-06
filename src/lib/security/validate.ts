/**
 * Input validation and sanitization utilities for API routes.
 *
 * All functions are pure and synchronous — no network calls, no env vars required.
 * Import these at the top of any Route Handler or Server Action to validate
 * untrusted client input before it touches your database or business logic.
 */

// ── UUID ───────────────────────────────────────────────────────────────────────

/** RFC 4122 UUID v4 pattern. */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns true if `value` is a valid UUID v4 string.
 *
 * Accepts both upper- and lower-case hex digits.
 *
 * @param value - The string to test.
 */
export function isValidUUID(value: string): boolean {
  return UUID_V4_RE.test(value);
}

// ── Ticker ─────────────────────────────────────────────────────────────────────

/**
 * Valid ticker pattern:
 *   - 1–5 uppercase ASCII letters (the base symbol, e.g. "AAPL", "T")
 *   - optionally followed by a dot and 1–4 uppercase letters (exchange suffix, e.g. ".US", ".XNYS")
 */
const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z]{1,4})?$/;

/**
 * Returns true if `value` is a valid stock ticker symbol.
 *
 * Accepts 1–5 uppercase letters with an optional exchange suffix
 * separated by a dot (e.g. "AAPL", "BRK.B", "T.US").
 *
 * @param value - The string to test.
 */
export function isValidTicker(value: string): boolean {
  return TICKER_RE.test(value);
}

// ── Monetary amount ────────────────────────────────────────────────────────────

/** Minimum transaction amount in cents (= $1.00). */
const MIN_AMOUNT_CENTS = 100;
/** Maximum transaction amount in cents (= $1,000,000.00). */
const MAX_AMOUNT_CENTS = 100_000_000;

/**
 * Returns true if `value` is a valid monetary amount expressed in cents.
 *
 * Requirements:
 *   - Must be a JavaScript number (not a string, bigint, etc.)
 *   - Must be a safe integer (no fractional cents)
 *   - Must be between $1.00 (100 cents) and $1,000,000.00 (100_000_000 cents) inclusive
 *
 * @param value - The value to test.
 */
export function isValidAmount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= MIN_AMOUNT_CENTS &&
    value <= MAX_AMOUNT_CENTS
  );
}

// ── String sanitization ────────────────────────────────────────────────────────

/**
 * Sanitizes a string for safe storage in the database.
 *
 * Operations applied (in order):
 *   1. Trims leading/trailing whitespace.
 *   2. Removes null bytes (`\0`) that can truncate strings in some databases.
 *   3. Truncates to `maxLength` characters.
 *
 * @param value     - The raw input string.
 * @param maxLength - Maximum allowed length after trimming (default 1000).
 * @returns The sanitized string.
 */
export function sanitizeString(value: string, maxLength = 1000): string {
  return value
    .trim()
    .replace(/\0/g, '')
    .slice(0, maxLength);
}

// ── Client IP extraction ───────────────────────────────────────────────────────

/**
 * Extracts the real client IP address from request headers.
 *
 * Checks headers in the following priority order to handle Cloudflare,
 * AWS ALB, Nginx, and other common reverse proxy setups:
 *   1. `CF-Connecting-IP`   — Cloudflare's real IP header
 *   2. `X-Real-IP`          — Standard nginx proxy header
 *   3. `X-Forwarded-For`    — De-facto standard; takes the first (leftmost) IP
 *   4. Falls back to `"unknown"` if none of the above are present
 *
 * Note: `X-Forwarded-For` can be spoofed by the client if your infrastructure
 * does not strip/overwrite it. Only trust these headers if your reverse proxy
 * is configured to set them authoritatively.
 *
 * @param request - The incoming Request object (Web API standard).
 * @returns The extracted IP address string, or `"unknown"` if unavailable.
 */
export function getClientIP(request: Request): string {
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP.trim();

  const realIP = request.headers.get('X-Real-IP');
  if (realIP) return realIP.trim();

  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) {
    // X-Forwarded-For: client, proxy1, proxy2 — leftmost is the original client
    const first = forwarded.split(',')[0];
    if (first) return first.trim();
  }

  return 'unknown';
}

// ── Safe redirect ──────────────────────────────────────────────────────────────

/**
 * Returns true if `url` is a safe internal redirect path.
 *
 * A safe redirect:
 *   - Starts with a single `/` (relative path, not a protocol-relative URL)
 *   - Does NOT contain `//` (prevents protocol-relative redirect attacks like `//evil.com`)
 *   - Does NOT contain a protocol scheme (e.g. `javascript:`, `http:`)
 *
 * Use this to validate the `callbackUrl` / `next` parameter before calling
 * `redirect()` to prevent open redirect vulnerabilities.
 *
 * @param url - The URL string to validate.
 * @returns True only if the URL is a safe internal path.
 */
export function isSafeRedirect(url: string): boolean {
  if (!url.startsWith('/')) return false;
  if (url.startsWith('//')) return false;
  if (/[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(url)) return false;
  return true;
}
