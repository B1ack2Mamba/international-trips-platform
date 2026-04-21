create table if not exists public.workspace_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  color text not null default '#7dd3fc',
  sort_order integer not null default 100,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_spaces_sort
  on public.workspace_spaces(sort_order, created_at desc);

drop trigger if exists set_workspace_spaces_updated_at on public.workspace_spaces;
create trigger set_workspace_spaces_updated_at
  before update on public.workspace_spaces
  for each row execute procedure public.set_updated_at();

create table if not exists public.workspace_space_modules (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.workspace_spaces(id) on delete cascade,
  module_key text not null,
  sort_order integer not null default 100,
  is_visible boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_space_modules_unique unique(space_id, module_key)
);

create index if not exists idx_workspace_space_modules_space
  on public.workspace_space_modules(space_id, sort_order, created_at desc);

drop trigger if exists set_workspace_space_modules_updated_at on public.workspace_space_modules;
create trigger set_workspace_space_modules_updated_at
  before update on public.workspace_space_modules
  for each row execute procedure public.set_updated_at();

create table if not exists public.workspace_space_links (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.workspace_spaces(id) on delete cascade,
  from_module_key text not null,
  to_module_key text not null,
  label text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_space_links_not_same check (from_module_key <> to_module_key)
);

create index if not exists idx_workspace_space_links_scope
  on public.workspace_space_links(space_id, sort_order, created_at desc);

drop trigger if exists set_workspace_space_links_updated_at on public.workspace_space_links;
create trigger set_workspace_space_links_updated_at
  before update on public.workspace_space_links
  for each row execute procedure public.set_updated_at();

create table if not exists public.workspace_space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.workspace_spaces(id) on delete cascade,
  assigned_email text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  member_label text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_space_members_unique unique(space_id, assigned_email)
);

create index if not exists idx_workspace_space_members_space
  on public.workspace_space_members(space_id, sort_order, created_at desc);
create index if not exists idx_workspace_space_members_email
  on public.workspace_space_members(lower(assigned_email));

drop trigger if exists set_workspace_space_members_updated_at on public.workspace_space_members;
create trigger set_workspace_space_members_updated_at
  before update on public.workspace_space_members
  for each row execute procedure public.set_updated_at();

alter table public.workspace_spaces enable row level security;
alter table public.workspace_space_modules enable row level security;
alter table public.workspace_space_links enable row level security;
alter table public.workspace_space_members enable row level security;

drop policy if exists "staff_read_workspace_spaces" on public.workspace_spaces;
drop policy if exists "admin_manage_workspace_spaces" on public.workspace_spaces;
create policy "staff_read_workspace_spaces"
  on public.workspace_spaces for select to authenticated
  using (public.is_staff());
create policy "admin_manage_workspace_spaces"
  on public.workspace_spaces for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "staff_read_workspace_space_modules" on public.workspace_space_modules;
drop policy if exists "admin_manage_workspace_space_modules" on public.workspace_space_modules;
create policy "staff_read_workspace_space_modules"
  on public.workspace_space_modules for select to authenticated
  using (public.is_staff());
create policy "admin_manage_workspace_space_modules"
  on public.workspace_space_modules for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "staff_read_workspace_space_links" on public.workspace_space_links;
drop policy if exists "admin_manage_workspace_space_links" on public.workspace_space_links;
create policy "staff_read_workspace_space_links"
  on public.workspace_space_links for select to authenticated
  using (public.is_staff());
create policy "admin_manage_workspace_space_links"
  on public.workspace_space_links for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "staff_read_workspace_space_members" on public.workspace_space_members;
drop policy if exists "admin_manage_workspace_space_members" on public.workspace_space_members;
create policy "staff_read_workspace_space_members"
  on public.workspace_space_members for select to authenticated
  using (public.is_staff());
create policy "admin_manage_workspace_space_members"
  on public.workspace_space_members for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
