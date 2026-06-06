/**
 * Field-level encryption utilities for sensitive data.
 *
 * Uses the Web Crypto API (crypto.subtle) with AES-GCM-256.
 * This module is server-only — never import it in client components.
 *
 * Required environment variable:
 *   ENCRYPTION_KEY — a 64-character hex string representing 32 bytes (256-bit key).
 *   Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

/** Lazily resolved AES-GCM CryptoKey derived from ENCRYPTION_KEY env var. */
let _keyPromise: Promise<CryptoKey> | null = null;

/**
 * Returns a cached AES-GCM CryptoKey derived from the ENCRYPTION_KEY env var.
 * Throws a descriptive error if the env var is missing or malformed.
 */
function getKey(): Promise<CryptoKey> {
  if (_keyPromise) return _keyPromise;

  _keyPromise = (async () => {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex) {
      throw new Error(
        '[encryption] ENCRYPTION_KEY environment variable is not set. ' +
          "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error(
        '[encryption] ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
          `Got length ${hex.length}.`
      );
    }

    const keyBytes = new Uint8Array(
      hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
    );

    return crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  })();

  return _keyPromise;
}

/**
 * Encodes a Uint8Array to a base64url string (no padding).
 */
function toBase64url(bytes: Uint8Array): string {
  const base64 = Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decodes a base64url string (with or without padding) to a Uint8Array.
 */
function fromBase64url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const base64 = pad === 0 ? padded : padded + '='.repeat(4 - pad);
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Encrypts a plaintext string using AES-GCM-256.
 *
 * A random 12-byte IV is generated per call and prepended to the ciphertext.
 * The result is encoded as base64url for safe storage in databases/JSON.
 *
 * Requires ENCRYPTION_KEY env var (64-char hex string).
 *
 * @param plaintext - The string to encrypt.
 * @returns A base64url-encoded string containing the IV + ciphertext.
 */
export async function encryptField(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const cipherBytes = new Uint8Array(cipherBuffer);
  // Prepend IV (12 bytes) to ciphertext
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);

  return toBase64url(combined);
}

/**
 * Decrypts a base64url-encoded ciphertext produced by {@link encryptField}.
 *
 * Expects the first 12 bytes to be the AES-GCM IV.
 * Requires ENCRYPTION_KEY env var (64-char hex string).
 *
 * @param ciphertext - A base64url-encoded string (IV + ciphertext).
 * @returns The original plaintext string.
 */
export async function decryptField(ciphertext: string): Promise<string> {
  const key = await getKey();
  const combined = fromBase64url(ciphertext);

  if (combined.length < 13) {
    throw new Error('[encryption] Ciphertext is too short to contain a valid IV.');
  }

  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipher
  );

  return new TextDecoder().decode(plainBuffer);
}

/**
 * Hashes a value with SHA-256 and returns a lowercase hex string.
 *
 * Useful for building lookup indexes over encrypted fields without exposing
 * the plaintext (e.g. "find the row whose email hash = X").
 *
 * Note: SHA-256 is deterministic — identical inputs always produce the same
 * hash. Do NOT use this for password storage (use bcrypt/argon2 for passwords).
 *
 * @param value - The string to hash.
 * @returns A lowercase hex string of the SHA-256 digest.
 */
export async function hashField(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Masks a string for safe display or logging, keeping only the last
 * `visibleChars` characters visible and replacing the rest with '*'.
 *
 * Example: maskValue("AB12345678", 4) → "AB123*****"
 * (last 4 chars from the right are preserved)
 *
 * If the string is shorter than or equal to `visibleChars`, the entire
 * string is replaced with asterisks.
 *
 * @param value        - The string to mask (e.g. account number, card number).
 * @param visibleChars - How many characters from the right to keep visible (default 4).
 * @returns The masked string.
 */
export function maskValue(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars) {
    return '*'.repeat(value.length);
  }
  const maskedCount = value.length - visibleChars;
  return '*'.repeat(maskedCount) + value.slice(maskedCount);
}
