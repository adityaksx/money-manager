-- Money Manager schema. Run this whole file in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.mm_accounts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 80), account_type text not null default 'bank' check(account_type in ('bank','cash','wallet')),
 institution text, opening_balance numeric(14,2) not null default 0 check(opening_balance >= 0), currency text not null default 'INR' check(currency='INR'),
 color text not null default '#16856b', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.mm_transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 account_id uuid references public.mm_accounts(id) on delete set null, kind text not null check(kind in ('income','expense')),
 amount numeric(14,2) not null check(amount > 0), category text not null, description text not null default '', occurred_on date not null default current_date, created_at timestamptz not null default now()
);
create table if not exists public.mm_budgets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 category text not null, monthly_limit numeric(14,2) not null check(monthly_limit > 0), month date not null default date_trunc('month',current_date)::date,
 created_at timestamptz not null default now(), unique(user_id,category,month)
);
create table if not exists public.mm_investments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 asset_type text not null check(asset_type in ('stock','mutual_fund','etf','gold','other')), name text not null, symbol text, platform text,
 units numeric(18,6) not null default 0 check(units >= 0), invested_amount numeric(14,2) not null check(invested_amount >= 0),
 current_value numeric(14,2) not null check(current_value >= 0), purchase_date date not null default current_date, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Cached quote data is refreshed on demand; the activity ledger is the source of transaction history.
alter table public.mm_investments add column if not exists exchange text;
alter table public.mm_investments add column if not exists current_price numeric(18,6) check(current_price is null or current_price >= 0);
alter table public.mm_investments add column if not exists price_updated_at timestamptz;
alter table public.mm_investments add column if not exists price_source text;

create table if not exists public.mm_investment_transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 investment_id uuid not null references public.mm_investments(id) on delete cascade,
 action text not null check(action in ('buy','sell')),
 units numeric(18,6) not null check(units > 0),
 unit_price numeric(18,6) not null check(unit_price > 0),
 fees numeric(14,2) not null default 0 check(fees >= 0),
 occurred_on date not null default current_date,
 notes text,
 created_at timestamptz not null default now()
);

create index if not exists mm_investment_transactions_user_asset_date_idx
 on public.mm_investment_transactions(user_id,investment_id,occurred_on,created_at);

create table if not exists public.mm_account_adjustments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 account_id uuid not null references public.mm_accounts(id) on delete cascade, amount numeric(14,2) not null check(amount<>0),
 note text not null default 'Balance adjustment', occurred_on date not null default current_date, created_at timestamptz not null default now()
);
create index if not exists mm_accounts_user_id_idx on public.mm_accounts(user_id);
create index if not exists mm_transactions_user_date_idx on public.mm_transactions(user_id,occurred_on desc);
create index if not exists mm_transactions_account_idx on public.mm_transactions(account_id);
create index if not exists mm_budgets_user_month_idx on public.mm_budgets(user_id,month);
create index if not exists mm_investments_user_type_idx on public.mm_investments(user_id,asset_type);
create index if not exists mm_adjustments_user_account_idx on public.mm_account_adjustments(user_id,account_id);
create index if not exists mm_account_adjustments_account_id_idx on public.mm_account_adjustments(account_id);
alter table public.mm_accounts enable row level security;
alter table public.mm_transactions enable row level security;
alter table public.mm_budgets enable row level security;
alter table public.mm_investments enable row level security;
alter table public.mm_investment_transactions enable row level security;
alter table public.mm_account_adjustments enable row level security;

-- Explicit policies; linked rows are also verified to belong to the signed-in user.
drop policy if exists accounts_select_own on public.mm_accounts;
create policy accounts_select_own on public.mm_accounts for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists accounts_insert_own on public.mm_accounts;
create policy accounts_insert_own on public.mm_accounts for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists accounts_update_own on public.mm_accounts;
create policy accounts_update_own on public.mm_accounts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists accounts_delete_own on public.mm_accounts;
create policy accounts_delete_own on public.mm_accounts for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists transactions_select_own on public.mm_transactions;
create policy transactions_select_own on public.mm_transactions for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists transactions_insert_own on public.mm_transactions;
create policy transactions_insert_own on public.mm_transactions for insert to authenticated with check(user_id=(select auth.uid()) and (account_id is null or exists(select 1 from public.mm_accounts a where a.id=account_id and a.user_id=(select auth.uid()))));
drop policy if exists transactions_update_own on public.mm_transactions;
create policy transactions_update_own on public.mm_transactions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and (account_id is null or exists(select 1 from public.mm_accounts a where a.id=account_id and a.user_id=(select auth.uid()))));
drop policy if exists transactions_delete_own on public.mm_transactions;
create policy transactions_delete_own on public.mm_transactions for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists budgets_select_own on public.mm_budgets;
create policy budgets_select_own on public.mm_budgets for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists budgets_insert_own on public.mm_budgets;
create policy budgets_insert_own on public.mm_budgets for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists budgets_update_own on public.mm_budgets;
create policy budgets_update_own on public.mm_budgets for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists budgets_delete_own on public.mm_budgets;
create policy budgets_delete_own on public.mm_budgets for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists investments_select_own on public.mm_investments;
create policy investments_select_own on public.mm_investments for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists investments_insert_own on public.mm_investments;
create policy investments_insert_own on public.mm_investments for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists investments_update_own on public.mm_investments;
create policy investments_update_own on public.mm_investments for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists investments_delete_own on public.mm_investments;
create policy investments_delete_own on public.mm_investments for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists investment_activity_select_own on public.mm_investment_transactions;
create policy investment_activity_select_own on public.mm_investment_transactions for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists investment_activity_insert_own on public.mm_investment_transactions;
create policy investment_activity_insert_own on public.mm_investment_transactions for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.mm_investments i where i.id=investment_id and i.user_id=(select auth.uid())));
drop policy if exists investment_activity_update_own on public.mm_investment_transactions;
create policy investment_activity_update_own on public.mm_investment_transactions for update to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.mm_investments i where i.id=investment_id and i.user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from public.mm_investments i where i.id=investment_id and i.user_id=(select auth.uid())));
drop policy if exists investment_activity_delete_own on public.mm_investment_transactions;
create policy investment_activity_delete_own on public.mm_investment_transactions for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists adjustments_select_own on public.mm_account_adjustments;
create policy adjustments_select_own on public.mm_account_adjustments for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.mm_accounts a where a.id=account_id and a.user_id=(select auth.uid())));
drop policy if exists adjustments_insert_own on public.mm_account_adjustments;
create policy adjustments_insert_own on public.mm_account_adjustments for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.mm_accounts a where a.id=account_id and a.user_id=(select auth.uid())));
drop policy if exists adjustments_update_own on public.mm_account_adjustments;
create policy adjustments_update_own on public.mm_account_adjustments for update to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.mm_accounts a where a.id=account_id and a.user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from public.mm_accounts a where a.id=account_id and a.user_id=(select auth.uid())));
drop policy if exists adjustments_delete_own on public.mm_account_adjustments;
create policy adjustments_delete_own on public.mm_account_adjustments for delete to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.mm_accounts a where a.id=account_id and a.user_id=(select auth.uid())));

create table if not exists public.mm_transaction_refunds (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 transaction_id uuid not null references public.mm_transactions(id) on delete cascade,
 amount numeric(14,2) not null check(amount > 0),
 received_on date not null default current_date,
 note text,
 created_at timestamptz not null default now()
);
create index if not exists mm_transaction_refunds_user_transaction_idx on public.mm_transaction_refunds(user_id,transaction_id,received_on);

create table if not exists public.mm_categories (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('income','expense')),
 name text not null check(char_length(trim(name)) between 1 and 48),
 is_default boolean not null default false,
 created_at timestamptz not null default now(),
 unique(user_id,kind,name)
);
create index if not exists mm_categories_user_kind_idx on public.mm_categories(user_id,kind,name);

create table if not exists public.mm_debts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 direction text not null check(direction in ('lent','borrowed')),
 person_name text not null check(char_length(trim(person_name)) between 1 and 100),
 amount numeric(14,2) not null check(amount > 0),
 occurred_on date not null default current_date,
 account_id uuid references public.mm_accounts(id) on delete set null,
 transaction_id uuid not null references public.mm_transactions(id) on delete restrict,
 note text,
 created_at timestamptz not null default now()
);
create index if not exists mm_debts_user_date_idx on public.mm_debts(user_id,occurred_on desc);

create table if not exists public.mm_debt_repayments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 debt_id uuid not null references public.mm_debts(id) on delete cascade,
 amount numeric(14,2) not null check(amount > 0),
 occurred_on date not null default current_date,
 transaction_id uuid not null references public.mm_transactions(id) on delete restrict,
 note text,
 created_at timestamptz not null default now()
);
create index if not exists mm_debt_repayments_user_debt_date_idx on public.mm_debt_repayments(user_id,debt_id,occurred_on);

create or replace function public.mm_validate_transaction_refund()
returns trigger language plpgsql as $
declare original_amount numeric(14,2); original_kind text; total_before numeric(14,2);
begin
 select amount,kind into original_amount,original_kind
 from public.mm_transactions where id=new.transaction_id and user_id=new.user_id;
 if not found or original_kind <> 'expense' then raise exception 'Refunds must be linked to your own expense transaction.'; end if;
 select coalesce(sum(amount),0) into total_before from public.mm_transaction_refunds
 where transaction_id=new.transaction_id and user_id=new.user_id and id is distinct from new.id;
 if total_before + new.amount > original_amount then raise exception 'Total refunds cannot exceed the original transaction amount.'; end if;
 return new;
end; $;
drop trigger if exists mm_transaction_refund_validate on public.mm_transaction_refunds;
create trigger mm_transaction_refund_validate before insert or update on public.mm_transaction_refunds
for each row execute function public.mm_validate_transaction_refund();

create or replace function public.mm_validate_debt_repayment()
returns trigger language plpgsql as $
declare principal numeric(14,2); total_before numeric(14,2);
begin
 select amount into principal from public.mm_debts where id=new.debt_id and user_id=new.user_id;
 if not found then raise exception 'Debt record not found for this user.'; end if;
 select coalesce(sum(amount),0) into total_before from public.mm_debt_repayments
 where debt_id=new.debt_id and user_id=new.user_id and id is distinct from new.id;
 if total_before + new.amount > principal then raise exception 'Total repayments cannot exceed the original amount.'; end if;
 return new;
end; $;
drop trigger if exists mm_debt_repayment_validate on public.mm_debt_repayments;
create trigger mm_debt_repayment_validate before insert or update on public.mm_debt_repayments
for each row execute function public.mm_validate_debt_repayment();

alter table public.mm_transaction_refunds enable row level security;
alter table public.mm_categories enable row level security;
alter table public.mm_debts enable row level security;
alter table public.mm_debt_repayments enable row level security;

drop policy if exists transaction_refunds_select_own on public.mm_transaction_refunds;
create policy transaction_refunds_select_own on public.mm_transaction_refunds for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.mm_transactions t where t.id=transaction_id and t.user_id=(select auth.uid())));
drop policy if exists transaction_refunds_insert_own on public.mm_transaction_refunds;
create policy transaction_refunds_insert_own on public.mm_transaction_refunds for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.mm_transactions t where t.id=transaction_id and t.user_id=(select auth.uid()) and t.kind='expense'));
drop policy if exists transaction_refunds_update_own on public.mm_transaction_refunds;
create policy transaction_refunds_update_own on public.mm_transaction_refunds for update to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.mm_transactions t where t.id=transaction_id and t.user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from public.mm_transactions t where t.id=transaction_id and t.user_id=(select auth.uid()) and t.kind='expense'));
drop policy if exists transaction_refunds_delete_own on public.mm_transaction_refunds;
create policy transaction_refunds_delete_own on public.mm_transaction_refunds for delete to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.mm_transactions t where t.id=transaction_id and t.user_id=(select auth.uid())));

drop policy if exists categories_select_own on public.mm_categories;
create policy categories_select_own on public.mm_categories for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists categories_insert_own on public.mm_categories;
create policy categories_insert_own on public.mm_categories for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists categories_update_custom on public.mm_categories;
create policy categories_update_custom on public.mm_categories for update to authenticated using(user_id=(select auth.uid()) and is_default=false) with check(user_id=(select auth.uid()) and is_default=false);
drop policy if exists categories_delete_custom on public.mm_categories;
create policy categories_delete_custom on public.mm_categories for delete to authenticated using(user_id=(select auth.uid()) and is_default=false);

drop policy if exists debts_select_own on public.mm_debts;
create policy debts_select_own on public.mm_debts for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.mm_transactions t where t.id=transaction_id and t.user_id=(select auth.uid())));
drop policy if exists debts_insert_own on public.mm_debts;
create policy debts_insert_own on public.mm_debts for insert to authenticated with check(user_id=(select auth.uid()) and (account_id is null or exists(select 1 from public.mm_accounts a where a.id=account_id and a.user_id=(select auth.uid()))) and exists(select 1 from public.mm_transactions t where t.id=transaction_id and t.user_id=(select auth.uid())));
drop policy if exists debts_update_own on public.mm_debts;
create policy debts_update_own on public.mm_debts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.mm_transactions t where t.id=transaction_id and t.user_id=(select auth.uid())));
drop policy if exists debts_delete_own on public.mm_debts;
create policy debts_delete_own on public.mm_debts for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists debt_repayments_select_own on public.mm_debt_repayments;
create policy debt_repayments_select_own on public.mm_debt_repayments for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.mm_debts d where d.id=debt_id and d.user_id=(select auth.uid())));
drop policy if exists debt_repayments_insert_own on public.mm_debt_repayments;
create policy debt_repayments_insert_own on public.mm_debt_repayments for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.mm_debts d where d.id=debt_id and d.user_id=(select auth.uid())) and exists(select 1 from public.mm_transactions t where t.id=transaction_id and t.user_id=(select auth.uid())));
drop policy if exists debt_repayments_update_own on public.mm_debt_repayments;
create policy debt_repayments_update_own on public.mm_debt_repayments for update to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.mm_debts d where d.id=debt_id and d.user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from public.mm_debts d where d.id=debt_id and d.user_id=(select auth.uid())));
drop policy if exists debt_repayments_delete_own on public.mm_debt_repayments;
create policy debt_repayments_delete_own on public.mm_debt_repayments for delete to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.mm_debts d where d.id=debt_id and d.user_id=(select auth.uid())));

revoke all on public.mm_accounts,public.mm_transactions,public.mm_budgets,public.mm_investments,public.mm_account_adjustments,public.mm_investment_transactions,public.mm_transaction_refunds,public.mm_categories,public.mm_debts,public.mm_debt_repayments from anon;
grant select,insert,update,delete on public.mm_accounts,public.mm_transactions,public.mm_budgets,public.mm_investments,public.mm_account_adjustments,public.mm_investment_transactions,public.mm_transaction_refunds,public.mm_categories,public.mm_debts,public.mm_debt_repayments to authenticated;

