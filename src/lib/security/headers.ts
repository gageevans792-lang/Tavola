/**
 * Security utility helpers for Tavola.
 * No external dependencies — uses only built-in Web Crypto APIs.
 */

/**
 * Ensure a redirect URL is an internal same-site path.
 * Returns '/dashboard' if the value is external, empty, or doesn't start with '/'.
 */
export function sanitizeRedirectUrl(url: string): string {
  if (!url || !url.startsWith("/")) {
    return "/dashboard";
  }

  // Reject protocol-relative URLs (//evil.com) and any embedded protocols
  if (url.startsWith("//") || /^\/[^/].*:/.test(url)) {
    return "/dashboard";
  }

  // Reject paths that contain path traversal sequences
  if (url.includes("/../") || url.includes("/./")) {
    return "/dashboard";
  }

  return url;
}

/**
 * Generate a cryptographically random CSRF token.
 * Uses crypto.randomUUID() — no external dependencies.
 */
export function generateCsrfToken(): string {
  return crypto.randomUUID();
}

/**
 * Mask sensitive data for safe logging.
 *
 * - email:   j***@example.com
 * - account: ****1234  (last 4 digits visible)
 */
export function maskSensitiveData(
  value: string,
  type: "email" | "account",
): string {
  if (!value) return "****";

  if (type === "email") {
    const atIndex = value.indexOf("@");
    if (atIndex <= 0) return "****";
    const localPart = value.slice(0, atIndex);
    const domain = value.slice(atIndex); // includes the '@'
    const visible = localPart.charAt(0);
    return `${visible}***${domain}`;
  }

  // account: show last 4 digits
  if (value.length <= 4) return "****";
  const last4 = value.slice(-4);
  return `****${last4}`;
}
