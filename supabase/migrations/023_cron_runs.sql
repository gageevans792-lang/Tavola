-- Idempotency table for cron dispatcher jobs.
-- Each job records its last-run slot; UNIQUE(job_name, slot_key) prevents
-- double-execution if the cron fires more than once in the same 15-min window.

create table if not exists public.cron_runs (
  id        bigserial    primary key,
  job_name  text         not null,
  slot_key  text         not null,  -- format: YYYY-MM-DD:H:bucket (e.g. 2026-08-01:9:0)
  ran_at    timestamptz  not null default now(),
  constraint cron_runs_unique unique (job_name, slot_key)
);

-- Service role only; no user-facing rows
alter table public.cron_runs enable row level security;
