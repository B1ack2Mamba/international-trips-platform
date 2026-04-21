alter table public.workspace_space_modules
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.workspace_space_modules
set metadata = '{}'::jsonb
where metadata is null;
