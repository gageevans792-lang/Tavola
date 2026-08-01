-- Recommendations: AI-generated investment guidance awaiting user decision
CREATE TABLE IF NOT EXISTS public.recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker          text NOT NULL,
  action          text NOT NULL CHECK (action IN ('buy', 'sell', 'hold')),
  qty             numeric NOT NULL DEFAULT 0,
  reasoning       text NOT NULL DEFAULT '',
  confidence      integer NOT NULL DEFAULT 0,
  source          text NOT NULL DEFAULT 'autopilot',
  user_decision   text NOT NULL DEFAULT 'pending' CHECK (user_decision IN ('pending', 'accepted', 'rejected', 'watching')),
  decision_at     timestamptz,
  outcome_pct_change numeric,
  outcome_date    date,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE IF EXISTS public.recommendations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recommendations' AND policyname='recommendations: own rows') THEN
    CREATE POLICY "recommendations: own rows" ON public.recommendations
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS recommendations_user_id_idx  ON public.recommendations(user_id);
CREATE INDEX IF NOT EXISTS recommendations_created_idx  ON public.recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS recommendations_decision_idx ON public.recommendations(user_id, user_decision);

-- Brokerages: user-declared brokerage connection intents
CREATE TABLE IF NOT EXISTS public.brokerages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider   text NOT NULL CHECK (provider IN ('fidelity', 'robinhood', 'schwab', 'etrade', 'vanguard')),
  status     text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'auth_pending', 'connected', 'disconnected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);
ALTER TABLE IF EXISTS public.brokerages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='brokerages' AND policyname='brokerages: own rows') THEN
    CREATE POLICY "brokerages: own rows" ON public.brokerages
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS brokerages_user_id_idx ON public.brokerages(user_id);
