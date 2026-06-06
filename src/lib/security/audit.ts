/**
 * Audit logging system for financial operations compliance.
 *
 * All financial actions are recorded in the `audit_log` table in Supabase.
 * Writes are best-effort — failures are logged to console and never re-thrown
 * so that audit failures never interrupt the user-facing operation.
 *
 * Required environment variables (at least one Supabase pair must be set):
 *   NEXT_PUBLIC_SUPABASE_URL      — the Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     — service role key (preferred for audit writes)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — anon key (fallback if service key absent)
 */

import { createClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

/** All trackable actions across the platform. */
export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.signup'
  | 'trade.placed'
  | 'trade.failed'
  | 'deposit.initiated'
  | 'deposit.completed'
  | 'analysis.run'
  | 'insight.executed'
  | 'settings.updated';

/** A single audit log entry. */
export interface AuditEntry {
  /** The authenticated user's UUID, or null for anonymous/pre-auth actions. */
  user_id: string | null;
  /** The action being recorded. */
  action: AuditAction;
  /** The ID of the primary resource affected (e.g. trade ID, deposit ID). */
  resource_id?: string;
  /** The type of the primary resource (e.g. 'trade', 'deposit', 'insight'). */
  resource_type?: string;
  /** Arbitrary structured metadata relevant to the action. */
  metadata?: Record<string, unknown>;
  /** Client IP address. */
  ip_address?: string;
  /** Raw User-Agent header value. */
  user_agent?: string;
  /** Whether the action succeeded or failed. */
  status: 'success' | 'failure';
  /** Human-readable error message if status === 'failure'. */
  error_message?: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Returns a Supabase client configured for server-side audit operations.
 * Uses the service role key when available (bypasses RLS for insert),
 * falling back to the anon key.
 *
 * @param serviceKey - Optional override service role key.
 */
function getSupabaseClient(serviceKey?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      '[audit] NEXT_PUBLIC_SUPABASE_URL environment variable is not set.'
    );
  }

  const key =
    serviceKey ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      '[audit] No Supabase key found. Set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Writes a single audit entry to the `audit_log` table in Supabase.
 *
 * This function is best-effort: it will never throw. If the write fails
 * (network error, misconfigured env vars, etc.) the error is logged to
 * `console.error` and the function returns normally. This ensures audit
 * failures never disrupt the user-facing operation being logged.
 *
 * Prefer calling this with SUPABASE_SERVICE_ROLE_KEY so that Row Level
 * Security does not block the insert (audit_log allows inserts only via
 * service role by design).
 *
 * @param entry      - The audit entry to record.
 * @param serviceKey - Optional Supabase service role key override.
 */
export async function writeAuditLog(
  entry: AuditEntry,
  serviceKey?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient(serviceKey);

    const { error } = await supabase.from('audit_log').insert({
      user_id: entry.user_id ?? null,
      action: entry.action,
      resource_id: entry.resource_id ?? null,
      resource_type: entry.resource_type ?? null,
      metadata: entry.metadata ?? null,
      ip_address: entry.ip_address ?? null,
      user_agent: entry.user_agent ?? null,
      status: entry.status,
      error_message: entry.error_message ?? null,
    });

    if (error) {
      console.error('[audit] Failed to write audit log entry:', error.message, {
        action: entry.action,
        user_id: entry.user_id,
        status: entry.status,
      });
    }
  } catch (err) {
    // Best-effort: never propagate audit failures to callers.
    console.error('[audit] Unexpected error writing audit log:', err, {
      action: entry.action,
      user_id: entry.user_id,
    });
  }
}

/**
 * Retrieves the audit log entries for a specific user.
 *
 * Returns entries ordered newest-first. Intended for use on an account
 * security / activity page where users can review their own history.
 *
 * Note: this uses the anon key, so Row Level Security must allow the
 * authenticated user to select their own rows (see audit_log RLS policy).
 *
 * @param userId - The UUID of the user whose audit log to retrieve.
 * @param limit  - Maximum number of entries to return (default 50).
 * @returns An array of AuditEntry objects, or an empty array on error.
 */
export async function getUserAuditLog(
  userId: string,
  limit = 50
): Promise<AuditEntry[]> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('audit_log')
      .select(
        'user_id, action, resource_id, resource_type, metadata, ip_address, user_agent, status, error_message'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[audit] Failed to retrieve audit log for user:', error.message, {
        user_id: userId,
      });
      return [];
    }

    return (data ?? []) as AuditEntry[];
  } catch (err) {
    console.error('[audit] Unexpected error retrieving audit log:', err, {
      user_id: userId,
    });
    return [];
  }
}
