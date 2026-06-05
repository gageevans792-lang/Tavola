-- ============================================================
-- Tavola — Database Schema
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- Enums
-- ============================================================

create type risk_level as enum ('conservative', 'balanced', 'growth', 'aggressive');
create type deposit_status as enum ('pending', 'completed', 'failed');
create type withdrawal_status as enum ('pending', 'completed', 'failed');
create type trade_side as enum ('buy', 'sell');
create type trade_status as enum ('pending', 'filled', 'cancelled');
create type insight_type as enum ('buy', 'sell', 'hold', 'rebalance', 'outlook');

-- ============================================================
-- Tables
-- ============================================================

-- 1. profiles
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  email         text,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

-- 2. risk_profiles
create table public.risk_profiles (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  level         risk_level not null default 'balanced',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 3. portfolios
create table public.portfolios (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  alpaca_account_id   text,
  total_value         numeric(18, 6) not null default 0,
  total_deposited     numeric(18, 6) not null default 0,
  total_return        numeric(18, 6) not null default 0,
  total_return_pct    numeric(10, 6) not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 4. deposits
create table public.deposits (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  amount              numeric(18, 6) not null,
  stripe_session_id   text,
  status              deposit_status not null default 'pending',
  created_at          timestamptz not null default now()
);

-- 5. withdrawals
create table public.withdrawals (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount      numeric(18, 6) not null,
  status      withdrawal_status not null default 'pending',
  created_at  timestamptz not null default now()
);

-- 6. trades
create table public.trades (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  ticker            text not null,
  side              trade_side not null,
  qty               numeric(18, 6) not null,
  price             numeric(18, 6),
  notional          numeric(18, 6),
  alpaca_order_id   text,
  ai_reasoning      text,
  confidence_score  integer check (confidence_score between 0 and 100),
  status            trade_status not null default 'pending',
  created_at        timestamptz not null default now()
);

-- 7. ai_insights
create table public.ai_insights (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  type              insight_type not null,
  ticker            text,
  message           text not null,
  confidence_score  integer check (confidence_score between 0 and 100),
  executed          boolean not null default false,
  created_at        timestamptz not null default now()
);

-- 8. holdings
create table public.holdings (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  ticker              text not null,
  name                text,
  qty                 numeric(18, 6) not null default 0,
  avg_entry_price     numeric(18, 6) not null default 0,
  current_price       numeric(18, 6) not null default 0,
  market_value        numeric(18, 6) not null default 0,
  unrealized_pl       numeric(18, 6) not null default 0,
  unrealized_plpc     numeric(10, 6) not null default 0,
  weight_pct          numeric(10, 6) not null default 0,
  updated_at          timestamptz not null default now(),
  unique (user_id, ticker)
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_risk_profiles_user_id    on public.risk_profiles  (user_id);
create index idx_portfolios_user_id       on public.portfolios      (user_id);
create index idx_deposits_user_id         on public.deposits        (user_id);
create index idx_withdrawals_user_id      on public.withdrawals     (user_id);
create index idx_trades_user_id           on public.trades          (user_id);
create index idx_trades_ticker            on public.trades          (ticker);
create index idx_ai_insights_user_id      on public.ai_insights     (user_id);
create index idx_holdings_user_id         on public.holdings        (user_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.risk_profiles enable row level security;
alter table public.portfolios  enable row level security;
alter table public.deposits    enable row level security;
alter table public.withdrawals enable row level security;
alter table public.trades      enable row level security;
alter table public.ai_insights enable row level security;
alter table public.holdings    enable row level security;

-- profiles: users can read and update their own row
create policy "profiles: own row select"  on public.profiles for select using (auth.uid() = id);
create policy "profiles: own row update"  on public.profiles for update using (auth.uid() = id);
create policy "profiles: own row insert"  on public.profiles for insert with check (auth.uid() = id);

-- risk_profiles
create policy "risk_profiles: own rows select" on public.risk_profiles for select using (auth.uid() = user_id);
create policy "risk_profiles: own rows insert" on public.risk_profiles for insert with check (auth.uid() = user_id);
create policy "risk_profiles: own rows update" on public.risk_profiles for update using (auth.uid() = user_id);
create policy "risk_profiles: own rows delete" on public.risk_profiles for delete using (auth.uid() = user_id);

-- portfolios
create policy "portfolios: own rows select" on public.portfolios for select using (auth.uid() = user_id);
create policy "portfolios: own rows insert" on public.portfolios for insert with check (auth.uid() = user_id);
create policy "portfolios: own rows update" on public.portfolios for update using (auth.uid() = user_id);
create policy "portfolios: own rows delete" on public.portfolios for delete using (auth.uid() = user_id);

-- deposits
create policy "deposits: own rows select" on public.deposits for select using (auth.uid() = user_id);
create policy "deposits: own rows insert" on public.deposits for insert with check (auth.uid() = user_id);
create policy "deposits: own rows update" on public.deposits for update using (auth.uid() = user_id);

-- withdrawals
create policy "withdrawals: own rows select" on public.withdrawals for select using (auth.uid() = user_id);
create policy "withdrawals: own rows insert" on public.withdrawals for insert with check (auth.uid() = user_id);
create policy "withdrawals: own rows update" on public.withdrawals for update using (auth.uid() = user_id);

-- trades
create policy "trades: own rows select" on public.trades for select using (auth.uid() = user_id);
create policy "trades: own rows insert" on public.trades for insert with check (auth.uid() = user_id);
create policy "trades: own rows update" on public.trades for update using (auth.uid() = user_id);

-- ai_insights
create policy "ai_insights: own rows select" on public.ai_insights for select using (auth.uid() = user_id);
create policy "ai_insights: own rows insert" on public.ai_insights for insert with check (auth.uid() = user_id);
create policy "ai_insights: own rows update" on public.ai_insights for update using (auth.uid() = user_id);

-- holdings
create policy "holdings: own rows select" on public.holdings for select using (auth.uid() = user_id);
create policy "holdings: own rows insert" on public.holdings for insert with check (auth.uid() = user_id);
create policy "holdings: own rows update" on public.holdings for update using (auth.uid() = user_id);
create policy "holdings: own rows delete" on public.holdings for delete using (auth.uid() = user_id);

-- ============================================================
-- Trigger: auto-create profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Trigger: updated_at auto-update for risk_profiles & portfolios
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_risk_profiles_updated_at
  before update on public.risk_profiles
  for each row execute procedure public.set_updated_at();

create trigger set_portfolios_updated_at
  before update on public.portfolios
  for each row execute procedure public.set_updated_at();
