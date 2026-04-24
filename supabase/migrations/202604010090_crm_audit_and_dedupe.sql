create table if not exists public.crm_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  changed_fields jsonb not null default '{}'::jsonb,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now(),
  constraint crm_audit_log_entity_type_check check (entity_type in ('lead','deal','application','contract','payment','task')),
  constraint crm_audit_log_action_check check (action in ('insert','update','delete'))
);

create index if not exists idx_crm_audit_log_entity on public.crm_audit_log(entity_type, entity_id, created_at desc);
create index if not exists idx_crm_audit_log_actor on public.crm_audit_log(actor_user_id, created_at desc);

alter table public.crm_audit_log enable row level security;

drop policy if exists "staff_manage_crm_audit_log" on public.crm_audit_log;
create policy "staff_manage_crm_audit_log"
  on public.crm_audit_log for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create or replace function public.find_duplicate_lead(
  p_lead_id uuid default null,
  p_phone_raw text default null,
  p_email_raw text default null
)
returns table(id uuid, owner_user_id uuid, contact_name_raw text, status text, converted_deal_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select public.normalize_phone(p_phone_raw) as phone, public.normalize_email(p_email_raw) as email
  )
  select l.id, l.owner_user_id, l.contact_name_raw, l.status, l.converted_deal_id
  from public.leads l, normalized n
  where (p_lead_id is null or l.id <> p_lead_id)
    and (
      (n.phone is not null and l.normalized_phone = n.phone)
      or (n.email is not null and l.normalized_email = n.email)
    )
  order by
    case when l.status in ('in_progress','qualified') then 0 else 1 end,
    l.created_at desc
  limit 1
$$;

create or replace function public.audit_crm_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_type text;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_changed jsonb := '{}'::jsonb;
  v_key text;
begin
  v_entity_type := case tg_table_name
    when 'leads' then 'lead'
    when 'deals' then 'deal'
    when 'applications' then 'application'
    when 'contracts' then 'contract'
    when 'payments' then 'payment'
    when 'tasks' then 'task'
    else tg_table_name
  end;

  if tg_op = 'DELETE' then
    v_entity_id := old.id;
    v_old := to_jsonb(old);
    insert into public.crm_audit_log(actor_user_id, entity_type, entity_id, action, changed_fields, old_data, new_data)
    values (auth.uid(), v_entity_type, v_entity_id, 'delete', '{}'::jsonb, v_old, null);
    return old;
  end if;

  v_entity_id := new.id;
  v_new := to_jsonb(new);

  if tg_op = 'INSERT' then
    insert into public.crm_audit_log(actor_user_id, entity_type, entity_id, action, changed_fields, old_data, new_data)
    values (auth.uid(), v_entity_type, v_entity_id, 'insert', v_new - 'updated_at', null, v_new);
    return new;
  end if;

  v_old := to_jsonb(old);
  for v_key in
    select key
    from jsonb_object_keys(v_new) as key
    where key not in ('updated_at')
  loop
    if (v_old -> v_key) is distinct from (v_new -> v_key) then
      v_changed := v_changed || jsonb_build_object(v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key));
    end if;
  end loop;

  if v_changed <> '{}'::jsonb then
    insert into public.crm_audit_log(actor_user_id, entity_type, entity_id, action, changed_fields, old_data, new_data)
    values (auth.uid(), v_entity_type, v_entity_id, 'update', v_changed, v_old, v_new);
  end if;

  return new;
end;
$$;

drop trigger if exists audit_leads_changes on public.leads;
create trigger audit_leads_changes after insert or update or delete on public.leads for each row execute procedure public.audit_crm_row_change();

drop trigger if exists audit_deals_changes on public.deals;
create trigger audit_deals_changes after insert or update or delete on public.deals for each row execute procedure public.audit_crm_row_change();

drop trigger if exists audit_applications_changes on public.applications;
create trigger audit_applications_changes after insert or update or delete on public.applications for each row execute procedure public.audit_crm_row_change();

drop trigger if exists audit_contracts_changes on public.contracts;
create trigger audit_contracts_changes after insert or update or delete on public.contracts for each row execute procedure public.audit_crm_row_change();

drop trigger if exists audit_payments_changes on public.payments;
create trigger audit_payments_changes after insert or update or delete on public.payments for each row execute procedure public.audit_crm_row_change();

drop trigger if exists audit_tasks_changes on public.tasks;
create trigger audit_tasks_changes after insert or update or delete on public.tasks for each row execute procedure public.audit_crm_row_change();
