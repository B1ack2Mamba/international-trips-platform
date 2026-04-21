create table if not exists public.workspace_visual_links (
  id uuid primary key default gen_random_uuid(),
  from_space_module_id uuid not null references public.workspace_space_modules(id) on delete cascade,
  to_space_module_id uuid not null references public.workspace_space_modules(id) on delete cascade,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_visual_links_not_same check (from_space_module_id <> to_space_module_id),
  constraint workspace_visual_links_unique unique (from_space_module_id, to_space_module_id)
);

create index if not exists idx_workspace_visual_links_from
  on public.workspace_visual_links(from_space_module_id, sort_order, created_at desc);

create index if not exists idx_workspace_visual_links_to
  on public.workspace_visual_links(to_space_module_id, sort_order, created_at desc);

drop trigger if exists set_workspace_visual_links_updated_at on public.workspace_visual_links;
create trigger set_workspace_visual_links_updated_at
  before update on public.workspace_visual_links
  for each row execute procedure public.set_updated_at();

alter table public.workspace_visual_links enable row level security;

drop policy if exists "staff_read_workspace_visual_links" on public.workspace_visual_links;
drop policy if exists "admin_manage_workspace_visual_links" on public.workspace_visual_links;
create policy "staff_read_workspace_visual_links"
  on public.workspace_visual_links for select to authenticated
  using (public.is_staff());
create policy "admin_manage_workspace_visual_links"
  on public.workspace_visual_links for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
