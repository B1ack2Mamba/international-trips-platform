create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  phone text,
  role text not null default 'viewer',
  locale text not null default 'ru',
  timezone text not null default 'Europe/Moscow',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('owner','admin','sales','ops','finance','partner','viewer'))
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('owner','admin','sales','ops','finance');
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

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  account_type text not null default 'family',
  status text not null default 'active',
  city text,
  country text,
  website_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_type_check check (account_type in ('family','school','business','partner','vendor','other')),
  constraint accounts_status_check check (status in ('active','inactive','archived'))
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  first_name text not null,
  last_name text,
  role_label text,
  phone text,
  email text,
  telegram_username text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  country text not null,
  city text,
  segment text not null,
  trip_type text not null,
  language text,
  duration_days integer not null default 14,
  short_description text,
  description text,
  public_slug text not null unique,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programs_segment_check check (segment in ('child','teen','student','adult','business')),
  constraint programs_trip_type_check check (trip_type in ('language-immersion','business-tour','conference-tour','hybrid')),
  constraint programs_duration_check check (duration_days > 0)
);

create table if not exists public.departures (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  departure_name text not null,
  city text,
  start_date date not null,
  end_date date not null,
  application_deadline date,
  seat_capacity integer not null default 0,
  status text not null default 'draft',
  base_price numeric(12,2) not null default 0,
  currency text not null default 'RUB',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departures_dates_check check (end_date >= start_date),
  constraint departures_status_check check (status in ('draft','published','selling','closed','cancelled','completed'))
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete set null,
  desired_program_id uuid references public.programs(id) on delete set null,
  desired_departure_id uuid references public.departures(id) on delete set null,
  source_channel text not null,
  source_detail text,
  contact_name_raw text,
  phone_raw text,
  email_raw text,
  desired_country text,
  status text not null default 'new',
  score integer,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_status_check check (status in ('new','assigned','in_progress','qualified','disqualified','duplicate','archived'))
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  program_id uuid references public.programs(id) on delete set null,
  departure_id uuid references public.departures(id) on delete set null,
  title text not null,
  stage text not null default 'qualified',
  estimated_value numeric(12,2),
  currency text not null default 'RUB',
  participants_count integer not null default 1,
  close_date date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_stage_check check (stage in ('qualified','proposal','negotiation','won','lost')),
  constraint deals_participants_check check (participants_count > 0)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete set null,
  departure_id uuid references public.departures(id) on delete set null,
  participant_name text not null,
  participant_birth_date date,
  guardian_name text,
  guardian_phone text,
  guardian_email text,
  status text not null default 'draft',
  documents_ready boolean not null default false,
  visa_status text,
  amount_total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_status_check check (status in ('draft','docs','visa','ready','cancelled','travelled')),
  constraint applications_amount_paid_check check (amount_paid >= 0),
  constraint applications_amount_total_check check (amount_total >= 0)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  external_payment_id text unique,
  payer_name text not null,
  label text not null,
  amount numeric(12,2) not null,
  currency text not null default 'RUB',
  due_date date,
  paid_at timestamptz,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_status_check check (status in ('pending','due','partial','paid','cancelled')),
  constraint payments_amount_check check (amount >= 0)
);

create table if not exists public.sales_scripts (
  id uuid primary key default gen_random_uuid(),
  segment text not null,
  stage text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_scripts_segment_check check (segment in ('child','teen','student','adult','business'))
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  due_date timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_status_check check (status in ('todo','doing','done','cancelled')),
  constraint tasks_priority_check check (priority in ('low','medium','high','critical'))
);

create index if not exists idx_accounts_owner on public.accounts(owner_user_id);
create index if not exists idx_contacts_account on public.contacts(account_id);
create index if not exists idx_departures_program_dates on public.departures(program_id, start_date);
create index if not exists idx_leads_owner_status on public.leads(owner_user_id, status, created_at desc);
create index if not exists idx_leads_source on public.leads(source_channel, created_at desc);
create index if not exists idx_deals_owner_stage on public.deals(owner_user_id, stage, created_at desc);
create index if not exists idx_applications_status on public.applications(status, created_at desc);
create index if not exists idx_payments_status_due on public.payments(status, due_date);
create index if not exists idx_tasks_owner_status on public.tasks(owner_user_id, status, due_date);

create trigger set_profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger set_accounts_updated_at before update on public.accounts for each row execute procedure public.set_updated_at();
create trigger set_contacts_updated_at before update on public.contacts for each row execute procedure public.set_updated_at();
create trigger set_programs_updated_at before update on public.programs for each row execute procedure public.set_updated_at();
create trigger set_departures_updated_at before update on public.departures for each row execute procedure public.set_updated_at();
create trigger set_leads_updated_at before update on public.leads for each row execute procedure public.set_updated_at();
create trigger set_deals_updated_at before update on public.deals for each row execute procedure public.set_updated_at();
create trigger set_applications_updated_at before update on public.applications for each row execute procedure public.set_updated_at();
create trigger set_payments_updated_at before update on public.payments for each row execute procedure public.set_updated_at();
create trigger set_sales_scripts_updated_at before update on public.sales_scripts for each row execute procedure public.set_updated_at();
create trigger set_tasks_updated_at before update on public.tasks for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.programs enable row level security;
alter table public.departures enable row level security;
alter table public.leads enable row level security;
alter table public.deals enable row level security;
alter table public.applications enable row level security;
alter table public.payments enable row level security;
alter table public.sales_scripts enable row level security;
alter table public.tasks enable row level security;

create policy "profiles_select_self_or_admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_self_or_admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "staff_manage_accounts"
  on public.accounts for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_contacts"
  on public.contacts for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "public_read_active_programs"
  on public.programs for select to anon, authenticated
  using (is_active = true or public.is_staff());

create policy "staff_manage_programs"
  on public.programs for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "public_read_live_departures"
  on public.departures for select to anon, authenticated
  using (status in ('published','selling') or public.is_staff());

create policy "staff_manage_departures"
  on public.departures for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "public_insert_leads"
  on public.leads for insert to anon, authenticated
  with check (
    status = 'new'
    and owner_user_id is null
    and source_channel in ('website','telegram','landing','partner','referral','manual')
  );

create policy "staff_manage_leads"
  on public.leads for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_deals"
  on public.deals for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_applications"
  on public.applications for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_payments"
  on public.payments for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_scripts"
  on public.sales_scripts for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_tasks"
  on public.tasks for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
