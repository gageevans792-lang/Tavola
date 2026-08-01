-- 019_institutional_holdings.sql
-- Stores parsed 13F-HR institutional holdings per fund per quarter.
-- Global table (no user_id). RLS: authenticated read, service role write.

CREATE TABLE IF NOT EXISTS public.institutional_holdings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_name    text        NOT NULL,
  fund_cik     text        NOT NULL,
  ticker       text        NOT NULL,
  shares       bigint      NOT NULL DEFAULT 0,
  value_usd    bigint      NOT NULL DEFAULT 0,       -- USD, not thousands
  quarter      text        NOT NULL,                  -- e.g. '2026-Q1'
  change_type  text        CHECK (change_type IN ('new','increased','reduced','exited')),
  pct_change   numeric(10,2),
  filed_at     date,
  created_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (fund_cik, ticker, quarter)
);

CREATE INDEX IF NOT EXISTS idx_inst_holdings_ticker  ON public.institutional_holdings (ticker);
CREATE INDEX IF NOT EXISTS idx_inst_holdings_quarter ON public.institutional_holdings (quarter);
CREATE INDEX IF NOT EXISTS idx_inst_holdings_fund    ON public.institutional_holdings (fund_cik);

ALTER TABLE public.institutional_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_institutional_holdings"
  ON public.institutional_holdings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "service_write_institutional_holdings"
  ON public.institutional_holdings FOR ALL
  TO service_role USING (true) WITH CHECK (true);
