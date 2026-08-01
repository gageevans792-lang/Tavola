-- 020_tax_harvesting.sql
-- Tax-loss harvesting: lot tracking and opportunity table.

CREATE TABLE IF NOT EXISTS public.tax_lots (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker            text        NOT NULL,
  shares            numeric(18,6) NOT NULL DEFAULT 0,
  cost_basis        numeric(14,2) NOT NULL DEFAULT 0,  -- total cost, not per share
  acquired_date     date        NOT NULL,
  lot_id            text,                              -- broker lot identifier if available
  closed            boolean     NOT NULL DEFAULT false,
  realized_gain_loss numeric(14,2),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_lots_user   ON public.tax_lots (user_id);
CREATE INDEX IF NOT EXISTS idx_tax_lots_ticker ON public.tax_lots (user_id, ticker);

ALTER TABLE public.tax_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_tax_lots" ON public.tax_lots FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.harvest_opportunities (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker               text        NOT NULL,
  unrealized_loss      numeric(14,2) NOT NULL DEFAULT 0,  -- negative number
  potential_tax_savings numeric(14,2) NOT NULL DEFAULT 0, -- positive number
  replacement_ticker   text,
  wash_sale_safe_date  date        NOT NULL,
  status               text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'harvested', 'expired')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_harvest_opps_user   ON public.harvest_opportunities (user_id);
CREATE INDEX IF NOT EXISTS idx_harvest_opps_status ON public.harvest_opportunities (user_id, status);

ALTER TABLE public.harvest_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_harvest_opportunities" ON public.harvest_opportunities FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
