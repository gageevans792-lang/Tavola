-- ============================================================
-- Migration: 001_audit_log
-- Audit log table for financial operations compliance.
--
-- Design notes:
--   - Only the service role may INSERT (no client inserts via RLS).
--   - Rows are immutable: no UPDATE or DELETE policies are defined.
--   - Users may SELECT only their own rows via the RLS policy below.
--   - ip_address uses the inet type for proper IP storage and indexing.
--   - Retention: entries older than 2 years should be purged by a scheduled
--     job (e.g. pg_cron) — see the commented index at the bottom.
-- ============================================================

create table if not exists public.audit_log (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete set null,
  action          text not null,
  resource_id     text,
  resource_type   text,
  metadata        jsonb,
  ip_address      inet,
  user_agent      text,
  status          text not null check (status in ('success', 'failure')),
  error_message   text,
  created_at      timestamptz not null default now()
);

-- ── Indexes for common query patterns ─────────────────────────────────────────

-- Fetch all audit entries for a given user (account security page)
create index if not exists idx_audit_log_user_id
  on public.audit_log (user_id);

-- Filter by action type (e.g. all 'trade.placed' events)
create index if not exists idx_audit_log_action
  on public.audit_log (action);

-- Time-range queries and newest-first ordering
create index if not exists idx_audit_log_created_at
  on public.audit_log (created_at desc);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.audit_log enable row level security;

-- Users may read only their own audit log rows.
create policy "audit_log: own rows select"
  on public.audit_log
  for select
  using (auth.uid() = user_id);

-- INSERT is intentionally restricted to the service role only.
-- No RLS insert policy is defined here — client sessions cannot insert.
-- The application uses the service role key via writeAuditLog() in
-- src/lib/security/audit.ts.

-- UPDATE and DELETE are intentionally omitted — audit logs are immutable.

-- ── Optional: retention index for pg_cron cleanup job ────────────────────────
-- Uncomment and schedule a pg_cron job to delete entries older than 2 years:
--
-- create index if not exists idx_audit_log_retention
--   on public.audit_log (created_at)
--   where created_at < now() - interval '2 years';
--
-- Example pg_cron job (run monthly):
-- select cron.schedule(
--   'audit_log_retention',
--   '0 3 1 * *',
--   $$delete from public.audit_log where created_at < now() - interval '2 years'$$
-- );
