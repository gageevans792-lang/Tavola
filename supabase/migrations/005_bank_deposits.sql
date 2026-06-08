-- Bank connections (mock — real Plaid integration would store link tokens etc.)
CREATE TABLE IF NOT EXISTS bank_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name       text NOT NULL,
  account_type    text NOT NULL DEFAULT 'checking', -- 'checking'|'savings'
  last_four       text NOT NULL,
  routing_number  text,
  is_verified     boolean NOT NULL DEFAULT false,
  connected_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank: own row" ON bank_connections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Recurring deposit schedules
CREATE TABLE IF NOT EXISTS recurring_deposits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL,
  frequency       text NOT NULL DEFAULT 'monthly', -- 'weekly'|'biweekly'|'monthly'
  next_deposit_at timestamptz NOT NULL,
  auto_invest     boolean NOT NULL DEFAULT true,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE recurring_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recurring: own row" ON recurring_deposits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transfer history
CREATE TABLE IF NOT EXISTS transfer_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL,
  type            text NOT NULL DEFAULT 'deposit', -- 'deposit'|'withdrawal'
  status          text NOT NULL DEFAULT 'completed',
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transfer_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers: own rows" ON transfer_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
