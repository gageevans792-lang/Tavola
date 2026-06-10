-- Add simulated flag to existing trades table (additive only)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT false;

-- user_accounts: one row per user storing simulated cash balance
CREATE TABLE IF NOT EXISTS public.user_accounts (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cash       numeric(14,4) NOT NULL DEFAULT 100000,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE IF EXISTS public.user_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='user_accounts' AND policyname='user_accounts: own rows'
  ) THEN
    CREATE POLICY "user_accounts: own rows" ON public.user_accounts
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- equity_history: daily portfolio value snapshots (one row per user per day)
CREATE TABLE IF NOT EXISTS public.equity_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  value      numeric(14,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE IF EXISTS public.equity_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='equity_history' AND policyname='equity_history: own rows'
  ) THEN
    CREATE POLICY "equity_history: own rows" ON public.equity_history
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
