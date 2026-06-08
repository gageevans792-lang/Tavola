-- Extend risk_profiles with full onboarding data
ALTER TABLE public.risk_profiles
  ADD COLUMN IF NOT EXISTS investment_goals   text[]        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS time_horizon       text,
  ADD COLUMN IF NOT EXISTS risk_quiz_answers  jsonb         DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS initial_deposit    numeric(12,2),
  ADD COLUMN IF NOT EXISTS monthly_contrib    numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_worth_range    text,
  ADD COLUMN IF NOT EXISTS onboarding_done    boolean       DEFAULT false;
