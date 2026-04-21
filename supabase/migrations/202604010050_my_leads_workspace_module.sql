insert into public.workspace_space_modules (space_id, module_key, sort_order, is_visible, metadata)
select s.id, 'my_leads', 25, true, jsonb_build_object('canvas', jsonb_build_object('x', 270, 'y', 128))
from public.workspace_spaces s
where s.slug = 'sales'
  and not exists (
    select 1
    from public.workspace_space_modules m
    where m.space_id = s.id
      and m.module_key = 'my_leads'
  );

insert into public.workspace_module_graph_nodes (module_key, sort_order, metadata)
select 'my_leads', 25, jsonb_build_object('canvas', jsonb_build_object('x', 380, 'y', 96))
where not exists (
  select 1
  from public.workspace_module_graph_nodes
  where module_key = 'my_leads'
);

insert into public.workspace_module_graph_links (from_module_key, to_module_key, sort_order)
select 'leads', 'my_leads', 15
where not exists (
  select 1
  from public.workspace_module_graph_links
  where from_module_key = 'leads'
    and to_module_key = 'my_leads'
);

insert into public.workspace_module_graph_links (from_module_key, to_module_key, sort_order)
select 'my_leads', 'deals', 25
where not exists (
  select 1
  from public.workspace_module_graph_links
  where from_module_key = 'my_leads'
    and to_module_key = 'deals'
);
