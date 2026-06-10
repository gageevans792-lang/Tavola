-- AI decision tracking: log every AutoPilot and Analysis decision for attribution scoring
create table if not exists ai_decisions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  session_type      text not null check (session_type in ('autopilot', 'analysis', 'autonomous')),
  symbol            text not null,
  action            text not null check (action in ('buy', 'sell', 'hold')),
  qty               numeric,
  confidence        integer check (confidence >= 0 and confidence <= 100),
  reasoning_summary text,
  price_at_decision numeric,
  estimated_value   numeric,
  risk_level        text check (risk_level in ('low', 'medium', 'high')),
  executed          boolean default false,
  created_at        timestamptz not null default now()
);

-- Enable RLS
alter table ai_decisions enable row level security;

create policy "Users can view own decisions"
  on ai_decisions for select
  using (auth.uid() = user_id);

create policy "Users can insert own decisions"
  on ai_decisions for insert
  with check (auth.uid() = user_id);

-- Index for fast lookups
create index if not exists ai_decisions_user_id_idx on ai_decisions(user_id);
create index if not exists ai_decisions_created_at_idx on ai_decisions(created_at desc);
create index if not exists ai_decisions_symbol_idx on ai_decisions(user_id, symbol);
