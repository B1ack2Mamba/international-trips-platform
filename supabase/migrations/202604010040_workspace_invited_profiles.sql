create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_invited boolean := false;
begin
  select exists (
    select 1
    from public.workspace_space_members
    where lower(assigned_email) = v_email
  )
  into v_invited;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when v_invited then 'sales' else 'viewer' end,
    true
  )
  on conflict (id) do update
  set
    email = excluded.email,
    role = case
      when v_invited and public.profiles.role not in (
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
      ) then 'sales'
      else public.profiles.role
    end,
    is_active = case when v_invited then true else public.profiles.is_active end;

  if v_invited then
    update public.workspace_space_members
    set profile_id = new.id
    where lower(assigned_email) = v_email
      and (profile_id is null or profile_id = new.id);
  end if;

  return new;
end;
$$;

update public.profiles p
set role = 'sales',
    is_active = true
where lower(p.email) in (
  select lower(assigned_email)
  from public.workspace_space_members
)
and p.role not in (
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

update public.workspace_space_members m
set profile_id = p.id
from public.profiles p
where lower(m.assigned_email) = lower(p.email)
  and (m.profile_id is null or m.profile_id = p.id);
