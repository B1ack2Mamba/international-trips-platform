alter table public.workspace_space_links
  add column if not exists from_space_id uuid references public.workspace_spaces(id) on delete cascade,
  add column if not exists to_space_id uuid references public.workspace_spaces(id) on delete cascade;

create index if not exists idx_workspace_space_links_from_space
  on public.workspace_space_links(from_space_id, from_module_key, sort_order, created_at desc);

create index if not exists idx_workspace_space_links_to_space
  on public.workspace_space_links(to_space_id, to_module_key, sort_order, created_at desc);

update public.workspace_space_links link
set
  from_space_id = coalesce(
    link.from_space_id,
    link.space_id,
    (
      select module.space_id
      from public.workspace_space_modules module
      where module.module_key = link.from_module_key
      order by module.sort_order asc, module.created_at asc
      limit 1
    )
  ),
  to_space_id = coalesce(
    link.to_space_id,
    link.space_id,
    (
      select module.space_id
      from public.workspace_space_modules module
      where module.module_key = link.to_module_key
      order by module.sort_order asc, module.created_at asc
      limit 1
    )
  )
where link.from_space_id is null or link.to_space_id is null;
