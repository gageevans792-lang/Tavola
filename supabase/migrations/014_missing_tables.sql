-- ── bank_connections ─────────────────────────────────────────────────────────
-- One row per user (upsert on user_id). Stores linked bank account metadata only —
-- no real account numbers. routing_number stored in plaintext (last-four only risk).
CREATE TABLE IF NOT EXISTS public.bank_connections (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name      text        NOT NULL CHECK (char_length(bank_name) <= 50),
  account_type   text        NOT NULL CHECK (account_type IN ('checking', 'savings')),
  last_four      text        NOT NULL CHECK (last_four ~ '^\d{4}$'),
  routing_number text,
  is_verified    boolean     NOT NULL DEFAULT false,
  connected_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_connections' AND policyname = 'bank_connections: own row') THEN
    CREATE POLICY "bank_connections: own row"
      ON public.bank_connections FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── recurring_deposits ────────────────────────────────────────────────────────
-- One row per user (upsert on user_id). Tracks scheduled deposit preferences.
CREATE TABLE IF NOT EXISTS public.recurring_deposits (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL CHECK (amount >= 50 AND amount <= 50000),
  frequency       text        NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  next_deposit_at timestamptz NOT NULL,
  auto_invest     boolean     NOT NULL DEFAULT true,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.recurring_deposits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_deposits' AND policyname = 'recurring_deposits: own row') THEN
    CREATE POLICY "recurring_deposits: own row"
      ON public.recurring_deposits FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── transfer_history ──────────────────────────────────────────────────────────
-- Append-only ledger of deposit/withdrawal events. Users can SELECT their own
-- rows. INSERT happens from user-session context (bank/schedule POST).
CREATE TABLE IF NOT EXISTS public.transfer_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      numeric(12,2) NOT NULL,
  type        text        NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  status      text        NOT NULL DEFAULT 'scheduled',
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transfer_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transfer_history' AND policyname = 'transfer_history: own rows select') THEN
    CREATE POLICY "transfer_history: own rows select"
      ON public.transfer_history FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transfer_history' AND policyname = 'transfer_history: own rows insert') THEN
    CREATE POLICY "transfer_history: own rows insert"
      ON public.transfer_history FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── user_strategies ───────────────────────────────────────────────────────────
-- One row per user storing their chosen investment strategy and trade preferences.
CREATE TABLE IF NOT EXISTS public.user_strategies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id     text        NOT NULL,
  auto_execute    boolean     NOT NULL DEFAULT false,
  max_trade_value numeric(12,2) NOT NULL DEFAULT 1000,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.user_strategies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_strategies' AND policyname = 'user_strategies: own row') THEN
    CREATE POLICY "user_strategies: own row"
      ON public.user_strategies FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── autonomous_sessions ───────────────────────────────────────────────────────
-- Audit log of every AI autonomous analysis run. Append-only; users may read
-- their own rows. INSERT from user-session context (autonomous route).
CREATE TABLE IF NOT EXISTS public.autonomous_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id       text,
  strategy_name     text,
  status            text        NOT NULL DEFAULT 'completed',
  auto_executed     boolean     NOT NULL DEFAULT false,
  trades_approved   int         NOT NULL DEFAULT 0,
  trades_executed   int         NOT NULL DEFAULT 0,
  total_trade_value numeric(14,2) NOT NULL DEFAULT 0,
  market_outlook    text,
  summary           text,
  warnings          text[]      NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.autonomous_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'autonomous_sessions' AND policyname = 'autonomous_sessions: own rows select') THEN
    CREATE POLICY "autonomous_sessions: own rows select"
      ON public.autonomous_sessions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'autonomous_sessions' AND policyname = 'autonomous_sessions: own rows insert') THEN
    CREATE POLICY "autonomous_sessions: own rows insert"
      ON public.autonomous_sessions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
