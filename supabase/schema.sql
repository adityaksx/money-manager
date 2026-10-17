-- Money Manager schema. Run this whole file in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.accounts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 80), account_type text not null default 'bank' check(account_type in ('bank','cash','wallet')),
 institution text, opening_balance numeric(14,2) not null default 0 check(opening_balance >= 0), currency text not null default 'INR' check(currency='INR'),
 color text not null default '#16856b', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 account_id uuid references public.accounts(id) on delete set null, kind text not null check(kind in ('income','expense','transfer')),
 amount numeric(14,2) not null check(amount > 0), category text not null, description text not null default '', occurred_on date not null default current_date, created_at timestamptz not null default now()
);
create table if not exists public.budgets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 category text not null, monthly_limit numeric(14,2) not null check(monthly_limit > 0), month date not null default date_trunc('month',current_date)::date,
 created_at timestamptz not null default now(), unique(user_id,category,month)
);
create table if not exists public.investments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 asset_type text not null check(asset_type in ('stock','mutual_fund','etf','gold','other')), name text not null, symbol text, platform text,
 units numeric(18,6) not null default 0 check(units >= 0), invested_amount numeric(14,2) not null check(invested_amount >= 0),
 current_value numeric(14,2) not null check(current_value >= 0), purchase_date date not null default current_date, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.account_adjustments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 account_id uuid not null references public.accounts(id) on delete cascade, amount numeric(14,2) not null check(amount<>0),
 note text not null default 'Balance adjustment', occurred_on date not null default current_date, created_at timestamptz not null default now()
);
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, display_name text, avatar_url text, currency text not null default 'INR', updated_at timestamptz not null default now()
);
create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists transactions_user_date_idx on public.transactions(user_id,occurred_on desc);
create index if not exists transactions_account_idx on public.transactions(account_id);
create index if not exists budgets_user_month_idx on public.budgets(user_id,month);
create index if not exists investments_user_type_idx on public.investments(user_id,asset_type);
create index if not exists adjustments_user_account_idx on public.account_adjustments(user_id,account_id);
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.investments enable row level security;
alter table public.account_adjustments enable row level security;
alter table public.profiles enable row level security;

-- Explicit policies; linked rows are also verified to belong to the signed-in user.
drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own on public.accounts for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own on public.accounts for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own on public.accounts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists accounts_delete_own on public.accounts;
create policy accounts_delete_own on public.accounts for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own on public.transactions for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own on public.transactions for insert to authenticated with check(user_id=(select auth.uid()) and (account_id is null or exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid()))));
drop policy if exists transactions_update_own on public.transactions;
create policy transactions_update_own on public.transactions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and (account_id is null or exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid()))));
drop policy if exists transactions_delete_own on public.transactions;
create policy transactions_delete_own on public.transactions for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists budgets_select_own on public.budgets;
create policy budgets_select_own on public.budgets for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists budgets_insert_own on public.budgets;
create policy budgets_insert_own on public.budgets for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists budgets_update_own on public.budgets;
create policy budgets_update_own on public.budgets for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists budgets_delete_own on public.budgets;
create policy budgets_delete_own on public.budgets for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists investments_select_own on public.investments;
create policy investments_select_own on public.investments for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists investments_insert_own on public.investments;
create policy investments_insert_own on public.investments for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists investments_update_own on public.investments;
create policy investments_update_own on public.investments for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists investments_delete_own on public.investments;
create policy investments_delete_own on public.investments for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists adjustments_select_own on public.account_adjustments;
create policy adjustments_select_own on public.account_adjustments for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())));
drop policy if exists adjustments_insert_own on public.account_adjustments;
create policy adjustments_insert_own on public.account_adjustments for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())));
drop policy if exists adjustments_update_own on public.account_adjustments;
create policy adjustments_update_own on public.account_adjustments for update to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())));
drop policy if exists adjustments_delete_own on public.account_adjustments;
create policy adjustments_delete_own on public.account_adjustments for delete to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.accounts a where a.id=account_id and a.user_id=(select auth.uid())));

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using(id=(select auth.uid()));
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check(id=(select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

revoke all on public.accounts,public.transactions,public.budgets,public.investments,public.account_adjustments,public.profiles from anon;
grant select,insert,update,delete on public.accounts,public.transactions,public.budgets,public.investments,public.account_adjustments to authenticated;
grant select,insert,update on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.profiles(id,display_name,avatar_url)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),new.raw_user_meta_data->>'avatar_url')
 on conflict(id) do update set display_name=excluded.display_name,avatar_url=excluded.avatar_url,updated_at=now();
 return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of raw_user_meta_data on auth.users for each row execute procedure public.handle_new_user();
