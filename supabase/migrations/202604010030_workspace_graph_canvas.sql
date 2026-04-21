create table if not exists public.workspace_module_graph_nodes (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_module_graph_nodes_unique unique (module_key)
);

create index if not exists idx_workspace_module_graph_nodes_module_key
  on public.workspace_module_graph_nodes(module_key);

create index if not exists idx_workspace_module_graph_nodes_sort
  on public.workspace_module_graph_nodes(sort_order, created_at desc);

drop trigger if exists set_workspace_module_graph_nodes_updated_at on public.workspace_module_graph_nodes;
create trigger set_workspace_module_graph_nodes_updated_at
  before update on public.workspace_module_graph_nodes
  for each row execute procedure public.set_updated_at();

create table if not exists public.workspace_module_graph_links (
  id uuid primary key default gen_random_uuid(),
  from_module_key text not null,
  to_module_key text not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_module_graph_links_not_same check (from_module_key <> to_module_key),
  constraint workspace_module_graph_links_unique unique (from_module_key, to_module_key)
);

create index if not exists idx_workspace_module_graph_links_from
  on public.workspace_module_graph_links(from_module_key, sort_order, created_at desc);

create index if not exists idx_workspace_module_graph_links_to
  on public.workspace_module_graph_links(to_module_key, sort_order, created_at desc);

drop trigger if exists set_workspace_module_graph_links_updated_at on public.workspace_module_graph_links;
create trigger set_workspace_module_graph_links_updated_at
  before update on public.workspace_module_graph_links
  for each row execute procedure public.set_updated_at();

alter table public.workspace_module_graph_nodes enable row level security;
alter table public.workspace_module_graph_links enable row level security;

drop policy if exists "staff_read_workspace_module_graph_nodes" on public.workspace_module_graph_nodes;
drop policy if exists "admin_manage_workspace_module_graph_nodes" on public.workspace_module_graph_nodes;
create policy "staff_read_workspace_module_graph_nodes"
  on public.workspace_module_graph_nodes for select to authenticated
  using (public.is_staff());
create policy "admin_manage_workspace_module_graph_nodes"
  on public.workspace_module_graph_nodes for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "staff_read_workspace_module_graph_links" on public.workspace_module_graph_links;
drop policy if exists "admin_manage_workspace_module_graph_links" on public.workspace_module_graph_links;
create policy "staff_read_workspace_module_graph_links"
  on public.workspace_module_graph_links for select to authenticated
  using (public.is_staff());
create policy "admin_manage_workspace_module_graph_links"
  on public.workspace_module_graph_links for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
