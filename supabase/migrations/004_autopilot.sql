CREATE TABLE IF NOT EXISTS autopilot_settings (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled       boolean NOT NULL DEFAULT false,
  frequency     text NOT NULL DEFAULT 'weekly', -- 'daily'|'weekly'|'monthly'
  max_trade_size numeric(12,2) NOT NULL DEFAULT 1000,
  last_run_at   timestamptz,
  next_run_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE autopilot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autopilot: own row" ON autopilot_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS autopilot_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_at          timestamptz NOT NULL DEFAULT now(),
  trades_executed int NOT NULL DEFAULT 0,
  total_value     numeric(12,2) NOT NULL DEFAULT 0,
  market_outlook  text,
  summary         text,
  decisions       jsonb NOT NULL DEFAULT '[]'::jsonb,
  status          text NOT NULL DEFAULT 'completed'
);
ALTER TABLE autopilot_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autopilot_runs: own rows" ON autopilot_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
