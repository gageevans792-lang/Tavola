-- Add RLS to notifications and predictive_signals tables (additive migration)

ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notifications: own rows') THEN
    CREATE POLICY "notifications: own rows" ON public.notifications
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE IF EXISTS public.predictive_signals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='predictive_signals' AND policyname='predictive_signals: own rows') THEN
    CREATE POLICY "predictive_signals: own rows" ON public.predictive_signals
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
