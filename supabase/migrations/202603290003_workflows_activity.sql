alter table public.leads
  add column if not exists converted_deal_id uuid references public.deals(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists qualified_at timestamptz,
  add column if not exists disqualified_reason text,
  add column if not exists next_action_at timestamptz,
  add column if not exists normalized_phone text,
  add column if not exists normalized_email text;

create index if not exists idx_leads_converted_deal on public.leads(converted_deal_id);
create index if not exists idx_leads_normalized_phone on public.leads(normalized_phone);
create index if not exists idx_leads_normalized_email on public.leads(normalized_email);

create or replace function public.normalize_phone(raw text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(raw, ''), '[^0-9]+', '', 'g'), '')
$$;

create or replace function public.normalize_email(raw text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(raw, ''))), '')
$$;

create or replace function public.set_lead_normalized_fields()
returns trigger
language plpgsql
as $$
begin
  new.normalized_phone = public.normalize_phone(new.phone_raw);
  new.normalized_email = public.normalize_email(new.email_raw);
  return new;
end;
$$;

drop trigger if exists set_leads_normalized_fields on public.leads;
create trigger set_leads_normalized_fields
  before insert or update on public.leads
  for each row execute procedure public.set_lead_normalized_fields();

update public.leads
set
  normalized_phone = public.normalize_phone(phone_raw),
  normalized_email = public.normalize_email(email_raw)
where true;

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_log_entity_type_check check (entity_type in ('lead','deal','application','payment','account','system'))
);

create index if not exists idx_activity_log_entity on public.activity_log(entity_type, entity_id, created_at desc);
create index if not exists idx_activity_log_actor on public.activity_log(actor_user_id, created_at desc);

alter table public.activity_log enable row level security;

create policy "staff_manage_activity_log"
  on public.activity_log for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create or replace function public.log_activity(
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_title text,
  p_body text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  insert into public.activity_log (
    actor_user_id,
    entity_type,
    entity_id,
    event_type,
    title,
    body,
    metadata
  )
  values (
    auth.uid(),
    p_entity_type,
    p_entity_id,
    p_event_type,
    p_title,
    p_body,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.assign_lead_to_self(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  update public.leads
  set
    owner_user_id = auth.uid(),
    assigned_at = coalesce(assigned_at, now()),
    status = case when status = 'new' then 'assigned' else status end
  where id = p_lead_id
  returning * into v_lead;

  if not found then
    raise exception 'lead_not_found';
  end if;

  perform public.log_activity(
    'lead',
    p_lead_id,
    'lead_assigned',
    'Лид взят в работу',
    coalesce(v_lead.contact_name_raw, 'Без имени'),
    jsonb_build_object('owner_user_id', auth.uid())
  );

  return p_lead_id;
end;
$$;

create or replace function public.update_lead_status(
  p_lead_id uuid,
  p_status text,
  p_note text default null,
  p_next_action_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  if p_status not in ('new','assigned','in_progress','qualified','disqualified','duplicate','archived') then
    raise exception 'invalid_lead_status';
  end if;

  update public.leads
  set
    status = p_status,
    owner_user_id = coalesce(owner_user_id, auth.uid()),
    qualified_at = case when p_status = 'qualified' then coalesce(qualified_at, now()) else qualified_at end,
    disqualified_reason = case when p_status = 'disqualified' then p_note else disqualified_reason end,
    next_action_at = coalesce(p_next_action_at, next_action_at)
  where id = p_lead_id
  returning * into v_lead;

  if not found then
    raise exception 'lead_not_found';
  end if;

  perform public.log_activity(
    'lead',
    p_lead_id,
    'lead_status_changed',
    'Статус лида обновлён',
    coalesce(p_note, 'Новый статус: ' || p_status),
    jsonb_build_object('status', p_status, 'next_action_at', p_next_action_at)
  );

  return p_lead_id;
end;
$$;

create or replace function public.convert_lead_to_deal(
  p_lead_id uuid,
  p_title text,
  p_stage text default 'qualified',
  p_estimated_value numeric default null,
  p_currency text default 'RUB',
  p_participants_count integer default 1,
  p_close_date date default null,
  p_notes text default null,
  p_create_account boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_deal_id uuid;
  v_account_id uuid;
  v_first_name text;
  v_last_name text;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  if p_stage not in ('qualified','proposal','negotiation','won','lost') then
    raise exception 'invalid_deal_stage';
  end if;

  if p_participants_count is null or p_participants_count < 1 then
    raise exception 'invalid_participants_count';
  end if;

  select * into v_lead
  from public.leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'lead_not_found';
  end if;

  if v_lead.converted_deal_id is not null then
    return v_lead.converted_deal_id;
  end if;

  if p_create_account then
    select c.account_id into v_account_id
    from public.contacts c
    where (
      v_lead.phone_raw is not null
      and c.phone = v_lead.phone_raw
    ) or (
      v_lead.email_raw is not null
      and lower(coalesce(c.email, '')) = lower(v_lead.email_raw)
    )
    order by c.is_primary desc, c.created_at asc
    limit 1;

    if v_account_id is null then
      insert into public.accounts (
        owner_user_id,
        display_name,
        account_type,
        status,
        notes,
        metadata
      )
      values (
        coalesce(v_lead.owner_user_id, auth.uid()),
        coalesce(v_lead.contact_name_raw, 'Новый контакт'),
        'family',
        'active',
        v_lead.message,
        jsonb_build_object('created_from', 'lead', 'lead_id', p_lead_id)
      )
      returning id into v_account_id;

      v_first_name := split_part(coalesce(v_lead.contact_name_raw, 'Новый'), ' ', 1);
      v_last_name := nullif(trim(regexp_replace(coalesce(v_lead.contact_name_raw, ''), '^\S+\s*', '')), '');

      insert into public.contacts (
        account_id,
        first_name,
        last_name,
        role_label,
        phone,
        email,
        is_primary,
        notes
      )
      values (
        v_account_id,
        coalesce(nullif(v_first_name, ''), 'Контакт'),
        v_last_name,
        'guardian',
        v_lead.phone_raw,
        v_lead.email_raw,
        true,
        'Создано автоматически из лида'
      );

      perform public.log_activity(
        'account',
        v_account_id,
        'account_created_from_lead',
        'Создан аккаунт семьи',
        coalesce(v_lead.contact_name_raw, 'Новый контакт'),
        jsonb_build_object('lead_id', p_lead_id)
      );
    end if;
  end if;

  insert into public.deals (
    owner_user_id,
    lead_id,
    account_id,
    program_id,
    departure_id,
    title,
    stage,
    estimated_value,
    currency,
    participants_count,
    close_date,
    notes
  )
  values (
    coalesce(v_lead.owner_user_id, auth.uid()),
    p_lead_id,
    v_account_id,
    v_lead.desired_program_id,
    v_lead.desired_departure_id,
    p_title,
    p_stage,
    p_estimated_value,
    coalesce(nullif(p_currency, ''), 'RUB'),
    p_participants_count,
    p_close_date,
    coalesce(p_notes, v_lead.message)
  )
  returning id into v_deal_id;

  update public.leads
  set
    status = 'qualified',
    owner_user_id = coalesce(owner_user_id, auth.uid()),
    qualified_at = coalesce(qualified_at, now()),
    converted_deal_id = v_deal_id
  where id = p_lead_id;

  insert into public.tasks (
    owner_user_id,
    lead_id,
    deal_id,
    title,
    description,
    status,
    priority,
    due_date,
    metadata
  )
  values (
    coalesce(v_lead.owner_user_id, auth.uid()),
    p_lead_id,
    v_deal_id,
    'Подготовить оффер и следующий шаг по сделке',
    'Система автоматически создала задачу после конвертации лида в сделку.',
    'todo',
    'high',
    now() + interval '1 day',
    jsonb_build_object('source', 'convert_lead_to_deal')
  );

  perform public.log_activity(
    'lead',
    p_lead_id,
    'lead_converted',
    'Лид конвертирован в сделку',
    p_title,
    jsonb_build_object('deal_id', v_deal_id, 'account_id', v_account_id)
  );

  perform public.log_activity(
    'deal',
    v_deal_id,
    'deal_created_from_lead',
    'Сделка создана из лида',
    coalesce(v_lead.contact_name_raw, 'Без имени'),
    jsonb_build_object('lead_id', p_lead_id, 'account_id', v_account_id)
  );

  return v_deal_id;
end;
$$;

create or replace function public.update_deal_stage(
  p_deal_id uuid,
  p_stage text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deal public.deals%rowtype;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  if p_stage not in ('qualified','proposal','negotiation','won','lost') then
    raise exception 'invalid_deal_stage';
  end if;

  update public.deals
  set stage = p_stage,
      notes = case when p_note is not null and p_note <> '' then coalesce(notes || E'\n\n', '') || p_note else notes end
  where id = p_deal_id
  returning * into v_deal;

  if not found then
    raise exception 'deal_not_found';
  end if;

  perform public.log_activity(
    'deal',
    p_deal_id,
    'deal_stage_changed',
    'Стадия сделки обновлена',
    coalesce(p_note, 'Новая стадия: ' || p_stage),
    jsonb_build_object('stage', p_stage)
  );

  return p_deal_id;
end;
$$;

create or replace function public.create_application_from_deal(
  p_deal_id uuid,
  p_participant_name text,
  p_guardian_name text default null,
  p_guardian_phone text default null,
  p_guardian_email text default null,
  p_amount_total numeric default null,
  p_due_date date default null,
  p_payment_label text default 'Предоплата',
  p_payment_amount numeric default null,
  p_create_payment boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deal public.deals%rowtype;
  v_application_id uuid;
  v_payment_amount numeric;
  v_total numeric;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  if p_participant_name is null or trim(p_participant_name) = '' then
    raise exception 'participant_name_required';
  end if;

  select * into v_deal
  from public.deals
  where id = p_deal_id
  for update;

  if not found then
    raise exception 'deal_not_found';
  end if;

  v_total := coalesce(p_amount_total, v_deal.estimated_value, 0);
  v_payment_amount := coalesce(p_payment_amount, v_total);

  insert into public.applications (
    deal_id,
    departure_id,
    participant_name,
    guardian_name,
    guardian_phone,
    guardian_email,
    status,
    amount_total,
    amount_paid,
    metadata
  )
  values (
    p_deal_id,
    v_deal.departure_id,
    p_participant_name,
    p_guardian_name,
    p_guardian_phone,
    p_guardian_email,
    'draft',
    v_total,
    0,
    jsonb_build_object('created_from', 'deal', 'deal_id', p_deal_id)
  )
  returning id into v_application_id;

  if p_create_payment then
    insert into public.payments (
      deal_id,
      application_id,
      payer_name,
      label,
      amount,
      currency,
      due_date,
      status,
      metadata
    )
    values (
      p_deal_id,
      v_application_id,
      coalesce(nullif(p_guardian_name, ''), p_participant_name),
      coalesce(nullif(p_payment_label, ''), 'Предоплата'),
      v_payment_amount,
      v_deal.currency,
      p_due_date,
      case when p_due_date is not null and p_due_date <= current_date then 'due' else 'pending' end,
      jsonb_build_object('created_from', 'application_workflow', 'deal_id', p_deal_id, 'application_id', v_application_id)
    );
  end if;

  if v_deal.stage <> 'won' then
    update public.deals set stage = 'won' where id = p_deal_id;
  end if;

  insert into public.tasks (
    owner_user_id,
    deal_id,
    application_id,
    title,
    description,
    status,
    priority,
    due_date,
    metadata
  )
  values (
    coalesce(v_deal.owner_user_id, auth.uid()),
    p_deal_id,
    v_application_id,
    'Проверить документы участника',
    'После создания заявки проверьте паспорт, согласия, визовый пакет и маршрут.',
    'todo',
    'high',
    now() + interval '2 days',
    jsonb_build_object('source', 'create_application_from_deal')
  );

  perform public.log_activity(
    'deal',
    p_deal_id,
    'application_created',
    'Из сделки создана заявка',
    p_participant_name,
    jsonb_build_object('application_id', v_application_id)
  );

  perform public.log_activity(
    'application',
    v_application_id,
    'application_created',
    'Создана заявка на поездку',
    p_participant_name,
    jsonb_build_object('deal_id', p_deal_id)
  );

  return v_application_id;
end;
$$;

create or replace function public.mark_payment_paid(
  p_payment_id uuid,
  p_paid_amount numeric default null,
  p_paid_at timestamptz default now(),
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_amount_to_apply numeric;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment_not_found';
  end if;

  if v_payment.status = 'paid' then
    return p_payment_id;
  end if;

  v_amount_to_apply := coalesce(p_paid_amount, v_payment.amount, 0);

  update public.payments
  set
    status = 'paid',
    paid_at = coalesce(p_paid_at, now()),
    metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{paid_note}', to_jsonb(coalesce(p_note, '')))
  where id = p_payment_id;

  if v_payment.application_id is not null then
    update public.applications
    set amount_paid = least(amount_total, coalesce(amount_paid, 0) + v_amount_to_apply)
    where id = v_payment.application_id;
  end if;

  perform public.log_activity(
    'payment',
    p_payment_id,
    'payment_paid',
    'Платёж отмечен как оплаченный',
    coalesce(p_note, v_payment.label),
    jsonb_build_object('amount', v_amount_to_apply, 'application_id', v_payment.application_id)
  );

  if v_payment.application_id is not null then
    perform public.log_activity(
      'application',
      v_payment.application_id,
      'payment_received',
      'По заявке зафиксирована оплата',
      coalesce(p_note, v_payment.label),
      jsonb_build_object('payment_id', p_payment_id, 'amount', v_amount_to_apply)
    );
  end if;

  return p_payment_id;
end;
$$;

grant execute on function public.log_activity(text, uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.assign_lead_to_self(uuid) to authenticated;
grant execute on function public.update_lead_status(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.convert_lead_to_deal(uuid, text, text, numeric, text, integer, date, text, boolean) to authenticated;
grant execute on function public.update_deal_stage(uuid, text, text) to authenticated;
grant execute on function public.create_application_from_deal(uuid, text, text, text, text, numeric, date, text, numeric, boolean) to authenticated;
grant execute on function public.mark_payment_paid(uuid, numeric, timestamptz, text) to authenticated;
