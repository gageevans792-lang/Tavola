-- 022_conviction_mode.sql
-- Adds conviction mode to autopilot_settings; creates tax_settings table.

-- Add conviction mode columns to autopilot_settings (additive only)
ALTER TABLE public.autopilot_settings
  ADD COLUMN IF NOT EXISTS conviction_mode         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conviction_acknowledged boolean NOT NULL DEFAULT false;

-- Tax settings per user
CREATE TABLE IF NOT EXISTS public.tax_settings (
  user_id            uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  marginal_rate      numeric(5,4) NOT NULL DEFAULT 0.24,  -- e.g. 0.24 = 24%
  state_tax_enabled  boolean NOT NULL DEFAULT false,
  state_tax_rate     numeric(5,4) NOT NULL DEFAULT 0.00,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_tax_settings" ON public.tax_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
