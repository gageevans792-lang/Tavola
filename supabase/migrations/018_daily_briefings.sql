-- 018_daily_briefings.sql
-- Daily AI strategy briefings — one global record per calendar day.

CREATE TABLE IF NOT EXISTS public.daily_briefings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date  date        NOT NULL,
  buys           jsonb       NOT NULL DEFAULT '[]',
  avoids         jsonb       NOT NULL DEFAULT '[]',
  outlook        text        NOT NULL DEFAULT '',
  email_sent     boolean     NOT NULL DEFAULT false,
  email_sent_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (briefing_date)
);

CREATE INDEX IF NOT EXISTS daily_briefings_date_idx
  ON public.daily_briefings (briefing_date DESC);

-- RLS: authenticated users read; service role writes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_briefings'
      AND policyname = 'daily_briefings_select_authenticated'
  ) THEN
    ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "daily_briefings_select_authenticated"
      ON public.daily_briefings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
