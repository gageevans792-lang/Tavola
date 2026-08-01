-- 021_interventions.sql
-- Behavioral intervention engine: tracks AI-generated calming messages and their effectiveness.

CREATE TABLE IF NOT EXISTS public.interventions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type      text        NOT NULL,  -- 'portfolio_drawdown_1d' | 'portfolio_drawdown_5d' | 'position_drawdown' | 'vix_spike' | 'consecutive_down_days'
  market_context    jsonb       NOT NULL DEFAULT '{}',  -- snapshot of market conditions at time of intervention
  message           text        NOT NULL,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  user_action_after text,                 -- 'sold' | 'held' | 'bought_more' | null (unknown)
  outcome_7d        numeric(10,2),        -- portfolio value change % over 7 days after intervention
  outcome_30d       numeric(10,2),        -- portfolio value change % over 30 days after intervention
  portfolio_value_at_intervention numeric(14,2),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interventions_user    ON public.interventions (user_id);
CREATE INDEX IF NOT EXISTS idx_interventions_sent_at ON public.interventions (user_id, sent_at);

ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_interventions" ON public.interventions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
