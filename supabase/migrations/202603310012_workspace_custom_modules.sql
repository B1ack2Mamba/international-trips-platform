create table if not exists public.workspace_custom_modules (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  slug text not null unique,
  description text,
  color text not null default '#7dd3fc',
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_custom_modules_sort
  on public.workspace_custom_modules(created_at desc);
create index if not exists idx_workspace_custom_modules_slug
  on public.workspace_custom_modules(lower(slug));

drop trigger if exists set_workspace_custom_modules_updated_at on public.workspace_custom_modules;
create trigger set_workspace_custom_modules_updated_at
  before update on public.workspace_custom_modules
  for each row execute procedure public.set_updated_at();

alter table public.workspace_custom_modules enable row level security;

drop policy if exists "staff_read_workspace_custom_modules" on public.workspace_custom_modules;
drop policy if exists "admin_manage_workspace_custom_modules" on public.workspace_custom_modules;
create policy "staff_read_workspace_custom_modules"
  on public.workspace_custom_modules for select to authenticated
  using (public.is_staff());
create policy "admin_manage_workspace_custom_modules"
  on public.workspace_custom_modules for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
