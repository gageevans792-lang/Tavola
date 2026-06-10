-- Extend notifications table with priority + action deep-link
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS priority   text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS action_url text;

-- Per-user notification preferences (replaces localStorage)
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pre_trade_alerts        boolean NOT NULL DEFAULT true,
  execution_confirmations boolean NOT NULL DEFAULT true,
  checkpoint_summaries    boolean NOT NULL DEFAULT true,
  weekly_letter           boolean NOT NULL DEFAULT true,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification settings"
  ON public.user_notification_settings
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
