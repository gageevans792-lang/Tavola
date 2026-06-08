-- Predictive signals: AI-generated event pre-positioning recommendations
create table if not exists predictive_signals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  event            text not null,
  event_date       date not null,
  affected_tickers text[] not null default '{}',
  action           text not null check (action in ('increase', 'reduce', 'hedge', 'hold')),
  reasoning        text not null,
  confidence       integer not null check (confidence between 0 and 100),
  created_at       timestamptz not null default now()
);

create index if not exists predictive_signals_user_id_idx on predictive_signals(user_id);
create index if not exists predictive_signals_event_date_idx on predictive_signals(event_date);

-- Waitlist: early access email capture from landing page
create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);
