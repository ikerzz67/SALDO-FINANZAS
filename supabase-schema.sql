-- SALDO: esquema privado para Supabase
-- Ejecuta todo este archivo en Supabase > SQL Editor > New query.
-- Cada usuario solo puede leer/escribir sus propias filas. No desactives RLS.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Mi espacio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  description text not null default '',
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique(user_id, category)
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  saved_amount numeric(12,2) not null default 0 check (saved_amount >= 0),
  target_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  frequency text not null default 'monthly' check (frequency in ('weekly','monthly','yearly')),
  next_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.recurring_expenses enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "transactions_all_own" on public.transactions;
create policy "transactions_all_own" on public.transactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budgets_all_own" on public.budgets;
create policy "budgets_all_own" on public.budgets for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "goals_all_own" on public.savings_goals;
create policy "goals_all_own" on public.savings_goals for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recurring_all_own" on public.recurring_expenses;
create policy "recurring_all_own" on public.recurring_expenses for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Mi espacio'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
