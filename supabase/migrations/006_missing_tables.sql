-- deposits (referenced by Stripe webhook)
CREATE TABLE IF NOT EXISTS public.deposits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount            numeric(12,2) NOT NULL,
  stripe_session_id text UNIQUE,
  status            text NOT NULL DEFAULT 'completed',
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE IF EXISTS public.deposits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deposits' AND policyname='deposits: own rows') THEN
    CREATE POLICY "deposits: own rows" ON public.deposits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- trades
CREATE TABLE IF NOT EXISTS public.trades (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker            text NOT NULL,
  side              text NOT NULL CHECK (side IN ('buy', 'sell')),
  qty               numeric(10,4) NOT NULL,
  price             numeric(12,4),
  alpaca_order_id   text,
  ai_reasoning      text,
  confidence_score  int,
  status            text NOT NULL DEFAULT 'pending',
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE IF EXISTS public.trades ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trades' AND policyname='trades: own rows') THEN
    CREATE POLICY "trades: own rows" ON public.trades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ai_insights
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker           text,
  type             text NOT NULL DEFAULT 'hold',
  qty              int,
  message          text,
  confidence_score int,
  executed         boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE IF EXISTS public.ai_insights ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_insights' AND policyname='ai_insights: own rows') THEN
    CREATE POLICY "ai_insights: own rows" ON public.ai_insights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- holdings
CREATE TABLE IF NOT EXISTS public.holdings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker           text NOT NULL,
  name             text,
  qty              numeric(10,4) NOT NULL DEFAULT 0,
  avg_entry_price  numeric(12,4) NOT NULL DEFAULT 0,
  current_price    numeric(12,4) NOT NULL DEFAULT 0,
  market_value     numeric(12,4) NOT NULL DEFAULT 0,
  unrealized_pl    numeric(12,4) NOT NULL DEFAULT 0,
  unrealized_plpc  numeric(10,6) NOT NULL DEFAULT 0,
  weight_pct       numeric(8,4) NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, ticker)
);
ALTER TABLE IF EXISTS public.holdings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='holdings' AND policyname='holdings: own rows') THEN
    CREATE POLICY "holdings: own rows" ON public.holdings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- user_watchlist
CREATE TABLE IF NOT EXISTS public.user_watchlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, ticker)
);
ALTER TABLE IF EXISTS public.user_watchlist ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_watchlist' AND policyname='watchlist: own rows') THEN
    CREATE POLICY "watchlist: own rows" ON public.user_watchlist FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
