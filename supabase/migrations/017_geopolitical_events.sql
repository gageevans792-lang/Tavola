-- 017_geopolitical_events.sql
-- Global geopolitical + market events table, populated hourly by cron via Claude analysis.
-- No user_id — events are shared across all users.

CREATE TABLE IF NOT EXISTS public.geopolitical_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  headline         text        NOT NULL,
  description      text        NOT NULL DEFAULT '',
  source           text        NOT NULL DEFAULT 'finnhub',
  event_category   text        NOT NULL DEFAULT 'geopolitical',
  ai_analysis      text        NOT NULL DEFAULT '',
  affected_sectors text[]      NOT NULL DEFAULT '{}',
  rotation_hedges  text[]      NOT NULL DEFAULT '{}',
  confidence       integer     NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS geopolitical_events_created_at_idx
  ON public.geopolitical_events (created_at DESC);

CREATE INDEX IF NOT EXISTS geopolitical_events_confidence_idx
  ON public.geopolitical_events (confidence DESC);

-- RLS: authenticated users can read; only service role can write
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'geopolitical_events'
      AND policyname = 'geopolitical_events_select_authenticated'
  ) THEN
    ALTER TABLE public.geopolitical_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "geopolitical_events_select_authenticated"
      ON public.geopolitical_events
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
