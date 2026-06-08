-- user strategy preferences (one active strategy per user)
CREATE TABLE IF NOT EXISTS user_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  strategy_id text NOT NULL DEFAULT 'balanced',
  auto_execute boolean DEFAULT false,
  max_trade_value numeric(12,2) DEFAULT 1000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own strategy" ON user_strategies FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- autonomous session log
CREATE TABLE IF NOT EXISTS autonomous_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  strategy_id text NOT NULL,
  strategy_name text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  auto_executed boolean DEFAULT false,
  trades_approved int DEFAULT 0,
  trades_executed int DEFAULT 0,
  total_trade_value numeric(12,2) DEFAULT 0,
  market_outlook text,
  summary text,
  warnings jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE autonomous_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sessions" ON autonomous_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own sessions" ON autonomous_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_autonomous_sessions_user
  ON autonomous_sessions(user_id, created_at DESC);
