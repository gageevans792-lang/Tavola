-- Add intraday checkpoint support

-- Pending-window and cancel support on trades
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS pending_until timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_token  text,
  ADD COLUMN IF NOT EXISTS trigger_type  text;  -- 'intraday_vix'|'intraday_position'|'intraday_sector'|'intraday_sentiment'

-- Extend ai_decisions with trigger context
ALTER TABLE public.ai_decisions
  ADD COLUMN IF NOT EXISTS trigger_type text;

-- Checkpoint log — one row per (user, checkpoint run)
CREATE TABLE IF NOT EXISTS public.checkpoint_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkpoint_time    text NOT NULL,           -- '9:35am' | '1:00pm' | '3:30pm'
  triggers_fired     text[] NOT NULL DEFAULT '{}',
  positions_reviewed text[] NOT NULL DEFAULT '{}',
  action_taken       text NOT NULL DEFAULT 'none',  -- 'none'|'pending_window'|'limit_reached'|'executed'
  trades_count       int NOT NULL DEFAULT 0,
  summary            text,
  run_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkpoint_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own checkpoints"
  ON public.checkpoint_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS checkpoint_log_user_id_idx ON public.checkpoint_log(user_id);
CREATE INDEX IF NOT EXISTS checkpoint_log_run_at_idx  ON public.checkpoint_log(run_at DESC);
CREATE INDEX IF NOT EXISTS trades_cancel_token_idx    ON public.trades(cancel_token) WHERE cancel_token IS NOT NULL;
