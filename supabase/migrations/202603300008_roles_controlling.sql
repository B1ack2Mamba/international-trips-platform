alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role in (
      'owner',
      'admin',
      'academic',
      'sales_head',
      'sales_manager',
      'backoffice',
      'finance',
      'controlling',
      'ops_manager',
      'curator',
      'marketing',
      'partner_manager',
      'sales',
      'ops',
      'partner',
      'viewer'
    )
  );

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in (
    'owner',
    'admin',
    'academic',
    'sales_head',
    'sales_manager',
    'backoffice',
    'finance',
    'controlling',
    'ops_manager',
    'curator',
    'marketing',
    'partner_manager',
    'sales',
    'ops'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('owner','admin');
$$;

create or replace function public.can_manage_finance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('owner','admin','finance','controlling');
$$;

create or replace function public.can_manage_programs()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('owner','admin','academic','marketing','ops_manager');
$$;

create or replace function public.can_manage_sales()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('owner','admin','sales_head','sales_manager','partner_manager','marketing','sales');
$$;

create or replace function public.can_manage_backoffice()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('owner','admin','backoffice','finance','ops_manager');
$$;

create or replace function public.can_manage_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('owner','admin','ops_manager','curator','backoffice','ops');
$$;

create or replace function public.can_manage_partners()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('owner','admin','partner_manager','marketing','sales_head','sales_manager');
$$;

create table if not exists public.controlling_expenses (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid references public.profiles(id) on delete set null,
  departure_id uuid references public.departures(id) on delete set null,
  title text not null,
  category text not null default 'other',
  expense_kind text not null default 'operating',
  expense_nature text not null default 'variable',
  scope_type text not null default 'company',
  amount numeric(12,2) not null default 0,
  currency text not null default 'RUB',
  recognized_on date not null default current_date,
  status text not null default 'active',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint controlling_expenses_kind_check check (expense_kind in ('operating','cogs')),
  constraint controlling_expenses_nature_check check (expense_nature in ('fixed','variable')),
  constraint controlling_expenses_scope_check check (scope_type in ('company','departure')),
  constraint controlling_expenses_status_check check (status in ('planned','active','paid','cancelled')),
  constraint controlling_expenses_amount_check check (amount >= 0),
  constraint controlling_expenses_scope_departure_check check (
    (scope_type = 'company' and departure_id is null) or
    (scope_type = 'departure' and departure_id is not null)
  )
);

create index if not exists idx_controlling_expenses_recognized_on
  on public.controlling_expenses(recognized_on desc, status);

create index if not exists idx_controlling_expenses_departure
  on public.controlling_expenses(departure_id, expense_kind, status);

drop trigger if exists set_controlling_expenses_updated_at on public.controlling_expenses;
create trigger set_controlling_expenses_updated_at
  before update on public.controlling_expenses
  for each row execute procedure public.set_updated_at();

alter table public.controlling_expenses enable row level security;

drop policy if exists "staff_read_controlling_expenses" on public.controlling_expenses;
drop policy if exists "finance_manage_controlling_expenses" on public.controlling_expenses;

create policy "staff_read_controlling_expenses"
  on public.controlling_expenses for select to authenticated
  using (public.is_staff());

create policy "finance_manage_controlling_expenses"
  on public.controlling_expenses for all to authenticated
  using (public.can_manage_finance())
  with check (public.can_manage_finance());

create or replace view public.reporting_controlling_summary as
with paid as (
  select coalesce(sum(amount), 0)::numeric(12,2) as paid_revenue
  from public.payments
  where status = 'paid'
),
expenses as (
  select
    coalesce(sum(case when expense_kind = 'cogs' and status in ('active','paid') then amount else 0 end), 0)::numeric(12,2) as cogs_total,
    coalesce(sum(case when expense_kind = 'operating' and status in ('active','paid') then amount else 0 end), 0)::numeric(12,2) as operating_expenses_total,
    coalesce(sum(case when expense_nature = 'fixed' and status in ('active','paid') then amount else 0 end), 0)::numeric(12,2) as fixed_expenses_total,
    coalesce(sum(case when expense_nature = 'variable' and status in ('active','paid') then amount else 0 end), 0)::numeric(12,2) as variable_expenses_total
  from public.controlling_expenses
)
select
  paid.paid_revenue,
  expenses.cogs_total,
  expenses.operating_expenses_total,
  expenses.fixed_expenses_total,
  expenses.variable_expenses_total,
  (paid.paid_revenue - expenses.cogs_total)::numeric(12,2) as gross_profit,
  (paid.paid_revenue - expenses.cogs_total - expenses.operating_expenses_total)::numeric(12,2) as net_profit
from paid, expenses;

grant select on public.reporting_controlling_summary to authenticated;

create or replace view public.reporting_departure_profitability as
with applications_agg as (
  select departure_id, count(*)::integer as applications_count
  from public.applications
  where departure_id is not null and status != 'cancelled'
  group by departure_id
),
revenue_agg as (
  select a.departure_id, coalesce(sum(p.amount), 0)::numeric(12,2) as paid_revenue
  from public.applications a
  left join public.payments p on p.application_id = a.id and p.status = 'paid'
  where a.departure_id is not null
  group by a.departure_id
),
cogs_agg as (
  select departure_id, coalesce(sum(amount), 0)::numeric(12,2) as cogs_total
  from public.controlling_expenses
  where departure_id is not null
    and expense_kind = 'cogs'
    and status in ('active','paid')
  group by departure_id
)
select
  d.id as departure_id,
  d.departure_name,
  d.start_date,
  d.status,
  coalesce(applications_agg.applications_count, 0) as applications_count,
  coalesce(revenue_agg.paid_revenue, 0)::numeric(12,2) as paid_revenue,
  coalesce(cogs_agg.cogs_total, 0)::numeric(12,2) as cogs_total,
  (coalesce(revenue_agg.paid_revenue, 0) - coalesce(cogs_agg.cogs_total, 0))::numeric(12,2) as gross_profit,
  case
    when coalesce(revenue_agg.paid_revenue, 0) > 0 then
      round(((coalesce(revenue_agg.paid_revenue, 0) - coalesce(cogs_agg.cogs_total, 0)) / coalesce(revenue_agg.paid_revenue, 0)) * 100, 2)
    else 0
  end::numeric(10,2) as margin_pct
from public.departures d
left join applications_agg on applications_agg.departure_id = d.id
left join revenue_agg on revenue_agg.departure_id = d.id
left join cogs_agg on cogs_agg.departure_id = d.id;

grant select on public.reporting_departure_profitability to authenticated;

grant execute on function public.can_manage_finance() to authenticated;
grant execute on function public.can_manage_programs() to authenticated;
grant execute on function public.can_manage_sales() to authenticated;
grant execute on function public.can_manage_backoffice() to authenticated;
grant execute on function public.can_manage_ops() to authenticated;
grant execute on function public.can_manage_partners() to authenticated;
