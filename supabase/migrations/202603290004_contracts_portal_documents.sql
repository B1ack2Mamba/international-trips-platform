alter table public.activity_log
  drop constraint if exists activity_log_entity_type_check;

alter table public.activity_log
  add constraint activity_log_entity_type_check
  check (entity_type in ('lead','deal','application','payment','account','contract','document','portal','system'));

create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  segment text,
  locale text not null default 'ru',
  is_active boolean not null default true,
  body_template text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_templates_segment_check check (segment is null or segment in ('child','teen','student','adult','business'))
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  contract_template_id uuid references public.contract_templates(id) on delete set null,
  contract_number text not null unique,
  title text not null,
  status text not null default 'draft',
  locale text not null default 'ru',
  payload jsonb not null default '{}'::jsonb,
  rendered_text text not null default '',
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  signatory_name text,
  signatory_email text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_status_check check (status in ('draft','ready','sent','viewed','signed','cancelled'))
);

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  code text not null,
  title text not null,
  status text not null default 'requested',
  due_date date,
  file_path text,
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejected_reason text,
  notes text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_documents_status_check check (status in ('requested','uploaded','verified','rejected','waived')),
  constraint application_documents_code_unique unique (application_id, code)
);

alter table public.applications
  add column if not exists portal_access_token uuid,
  add column if not exists portal_access_enabled boolean not null default true,
  add column if not exists portal_access_expires_at timestamptz,
  add column if not exists portal_last_opened_at timestamptz,
  add column if not exists documents_completion_pct integer not null default 0,
  add column if not exists current_contract_id uuid;

update public.applications
set portal_access_token = gen_random_uuid()
where portal_access_token is null;

alter table public.applications
  alter column portal_access_token set default gen_random_uuid();

alter table public.applications
  alter column portal_access_token set not null;

alter table public.applications
  add constraint applications_portal_access_token_unique unique (portal_access_token);

alter table public.applications
  add constraint applications_current_contract_fk
  foreign key (current_contract_id) references public.contracts(id) on delete set null;

create index if not exists idx_contracts_application_status on public.contracts(application_id, status, created_at desc);
create index if not exists idx_contracts_deal on public.contracts(deal_id, created_at desc);
create index if not exists idx_contracts_account on public.contracts(account_id, created_at desc);
create index if not exists idx_application_documents_application_status on public.application_documents(application_id, status, sort_order);
create index if not exists idx_applications_portal_token on public.applications(portal_access_token);

create trigger set_contract_templates_updated_at before update on public.contract_templates for each row execute procedure public.set_updated_at();
create trigger set_contracts_updated_at before update on public.contracts for each row execute procedure public.set_updated_at();
create trigger set_application_documents_updated_at before update on public.application_documents for each row execute procedure public.set_updated_at();

alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;
alter table public.application_documents enable row level security;

create policy "staff_manage_contract_templates"
  on public.contract_templates for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_contracts"
  on public.contracts for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_application_documents"
  on public.application_documents for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create or replace function public.generate_contract_number()
returns text
language sql
as $$
  select 'CTR-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
$$;

create or replace function public.apply_template(p_template text, p_payload jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_key text;
  v_value text;
  v_output text := coalesce(p_template, '');
begin
  for v_key, v_value in
    select key, value
    from jsonb_each_text(coalesce(p_payload, '{}'::jsonb))
  loop
    v_output := replace(v_output, '{{' || v_key || '}}', coalesce(v_value, ''));
  end loop;

  return regexp_replace(v_output, '\{\{[^}]+\}\}', '—', 'g');
end;
$$;

create or replace function public.recompute_application_documents_progress(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_ready integer;
begin
  select count(*),
         count(*) filter (where status in ('verified', 'waived'))
    into v_total, v_ready
  from public.application_documents
  where application_id = p_application_id;

  update public.applications
  set
    documents_ready = case when v_total > 0 and v_ready = v_total then true else false end,
    documents_completion_pct = case when v_total = 0 then 0 else round((v_ready::numeric / v_total::numeric) * 100)::integer end
  where id = p_application_id;
end;
$$;

create or replace function public.application_documents_progress_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application_id uuid;
begin
  v_application_id := coalesce(new.application_id, old.application_id);
  perform public.recompute_application_documents_progress(v_application_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists application_documents_progress_after_change on public.application_documents;
create trigger application_documents_progress_after_change
  after insert or update or delete on public.application_documents
  for each row execute procedure public.application_documents_progress_trigger();

create or replace function public.update_application_status(
  p_application_id uuid,
  p_status text,
  p_visa_status text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.applications%rowtype;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  if p_status not in ('draft','docs','visa','ready','cancelled','travelled') then
    raise exception 'invalid_application_status';
  end if;

  update public.applications
  set
    status = p_status,
    visa_status = coalesce(p_visa_status, visa_status),
    notes = case
      when p_note is not null and trim(p_note) <> '' then coalesce(notes || E'\n\n', '') || p_note
      else notes
    end
  where id = p_application_id
  returning * into v_application;

  if not found then
    raise exception 'application_not_found';
  end if;

  perform public.log_activity(
    'application',
    p_application_id,
    'application_status_changed',
    'Статус заявки обновлён',
    coalesce(p_note, 'Новый статус: ' || p_status),
    jsonb_build_object('status', p_status, 'visa_status', p_visa_status)
  );

  return p_application_id;
end;
$$;

create or replace function public.seed_application_document_checklist(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  select exists(select 1 from public.applications where id = p_application_id) into v_exists;
  if not v_exists then
    raise exception 'application_not_found';
  end if;

  insert into public.application_documents (application_id, code, title, status, sort_order)
  values
    (p_application_id, 'passport_scan', 'Скан паспорта участника', 'requested', 10),
    (p_application_id, 'guardian_passport', 'Скан паспорта родителя / плательщика', 'requested', 20),
    (p_application_id, 'photo', 'Фото на визу / анкету', 'requested', 30),
    (p_application_id, 'consent', 'Нотариальное согласие / разрешение', 'requested', 40),
    (p_application_id, 'medical_form', 'Медицинская форма / страховка', 'requested', 50),
    (p_application_id, 'flight_data', 'Данные по перелёту / бронированию', 'requested', 60)
  on conflict (application_id, code) do nothing;

  perform public.recompute_application_documents_progress(p_application_id);

  perform public.log_activity(
    'application',
    p_application_id,
    'document_checklist_seeded',
    'Создан базовый чек-лист документов',
    'Система добавила стандартный набор документов для заявки.',
    jsonb_build_object('source', 'seed_application_document_checklist')
  );

  return p_application_id;
end;
$$;

create or replace function public.update_application_document_status(
  p_document_id uuid,
  p_status text,
  p_note text default null,
  p_rejected_reason text default null,
  p_file_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.application_documents%rowtype;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  if p_status not in ('requested','uploaded','verified','rejected','waived') then
    raise exception 'invalid_document_status';
  end if;

  update public.application_documents
  set
    status = p_status,
    file_path = coalesce(p_file_path, file_path),
    reviewed_by_user_id = case when p_status in ('verified', 'rejected', 'waived') then auth.uid() else reviewed_by_user_id end,
    reviewed_at = case when p_status in ('verified', 'rejected', 'waived') then now() else reviewed_at end,
    rejected_reason = case when p_status = 'rejected' then p_rejected_reason else rejected_reason end,
    notes = case
      when p_note is not null and trim(p_note) <> '' then coalesce(notes || E'\n\n', '') || p_note
      else notes
    end
  where id = p_document_id
  returning * into v_document;

  if not found then
    raise exception 'document_not_found';
  end if;

  perform public.log_activity(
    'document',
    p_document_id,
    'document_status_changed',
    'Статус документа обновлён',
    coalesce(p_note, 'Новый статус: ' || p_status),
    jsonb_build_object(
      'application_id', v_document.application_id,
      'status', p_status,
      'rejected_reason', p_rejected_reason,
      'file_path', p_file_path
    )
  );

  perform public.log_activity(
    'application',
    v_document.application_id,
    'application_document_status_changed',
    'Изменён статус документа в заявке',
    v_document.title || ' → ' || p_status,
    jsonb_build_object('document_id', p_document_id, 'code', v_document.code, 'status', p_status)
  );

  return p_document_id;
end;
$$;

create or replace function public.create_contract_from_application(
  p_application_id uuid,
  p_template_code text default 'family_standard',
  p_mark_ready boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
  v_template public.contract_templates%rowtype;
  v_contract_id uuid;
  v_contract_number text;
  v_payload jsonb;
  v_title text;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  select
    a.id,
    a.deal_id,
    a.departure_id,
    a.participant_name,
    a.guardian_name,
    a.guardian_phone,
    a.guardian_email,
    a.amount_total,
    a.amount_paid,
    d.account_id,
    d.title as deal_title,
    d.currency,
    p.title as program_title,
    p.country as program_country,
    p.city as program_city,
    dep.departure_name,
    dep.start_date,
    dep.end_date,
    dep.currency as departure_currency,
    acc.display_name as account_name
  into v_app
  from public.applications a
  left join public.deals d on d.id = a.deal_id
  left join public.departures dep on dep.id = coalesce(a.departure_id, d.departure_id)
  left join public.programs p on p.id = coalesce(d.program_id, dep.program_id)
  left join public.accounts acc on acc.id = d.account_id
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'application_not_found';
  end if;

  select * into v_template
  from public.contract_templates
  where code = p_template_code
    and is_active = true
  order by created_at asc
  limit 1;

  if not found then
    raise exception 'contract_template_not_found';
  end if;

  v_contract_number := public.generate_contract_number();
  v_title := coalesce(v_template.title, 'Договор') || ' / ' || coalesce(v_app.participant_name, 'Участник');

  v_payload := jsonb_build_object(
    'contract_number', v_contract_number,
    'generated_date_display', to_char(current_date, 'DD.MM.YYYY'),
    'participant_name', coalesce(v_app.participant_name, '—'),
    'guardian_name', coalesce(v_app.guardian_name, '—'),
    'guardian_phone', coalesce(v_app.guardian_phone, '—'),
    'guardian_email', coalesce(v_app.guardian_email, '—'),
    'account_name', coalesce(v_app.account_name, '—'),
    'program_title', coalesce(v_app.program_title, '—'),
    'program_country', coalesce(v_app.program_country, '—'),
    'program_city', coalesce(v_app.program_city, '—'),
    'departure_name', coalesce(v_app.departure_name, '—'),
    'departure_start_date_display', coalesce(to_char(v_app.start_date, 'DD.MM.YYYY'), '—'),
    'departure_end_date_display', coalesce(to_char(v_app.end_date, 'DD.MM.YYYY'), '—'),
    'trip_dates_display', case
      when v_app.start_date is not null and v_app.end_date is not null then to_char(v_app.start_date, 'DD.MM.YYYY') || ' — ' || to_char(v_app.end_date, 'DD.MM.YYYY')
      else '—'
    end,
    'deal_title', coalesce(v_app.deal_title, '—'),
    'amount_total_display', coalesce(v_app.amount_total::text, '0'),
    'amount_paid_display', coalesce(v_app.amount_paid::text, '0'),
    'amount_due_display', greatest(coalesce(v_app.amount_total, 0) - coalesce(v_app.amount_paid, 0), 0)::text,
    'currency', coalesce(v_app.departure_currency, v_app.currency, 'RUB')
  );

  insert into public.contracts (
    application_id,
    deal_id,
    account_id,
    contract_template_id,
    contract_number,
    title,
    status,
    locale,
    payload,
    rendered_text,
    signatory_name,
    signatory_email,
    metadata
  )
  values (
    p_application_id,
    v_app.deal_id,
    v_app.account_id,
    v_template.id,
    v_contract_number,
    v_title,
    case when p_mark_ready then 'ready' else 'draft' end,
    v_template.locale,
    v_payload,
    public.apply_template(v_template.body_template, v_payload),
    v_app.guardian_name,
    v_app.guardian_email,
    jsonb_build_object('template_code', v_template.code)
  )
  returning id into v_contract_id;

  update public.applications
  set current_contract_id = v_contract_id
  where id = p_application_id;

  perform public.log_activity(
    'contract',
    v_contract_id,
    'contract_created',
    'Создан договор',
    v_title,
    jsonb_build_object('application_id', p_application_id, 'template_code', v_template.code, 'contract_number', v_contract_number)
  );

  perform public.log_activity(
    'application',
    p_application_id,
    'application_contract_created',
    'К заявке создан договор',
    v_title,
    jsonb_build_object('contract_id', v_contract_id, 'template_code', v_template.code)
  );

  return v_contract_id;
end;
$$;

create or replace function public.mark_contract_status(
  p_contract_id uuid,
  p_status text,
  p_note text default null,
  p_signatory_name text default null,
  p_signatory_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.contracts%rowtype;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  if p_status not in ('draft','ready','sent','viewed','signed','cancelled') then
    raise exception 'invalid_contract_status';
  end if;

  update public.contracts
  set
    status = p_status,
    sent_at = case when p_status = 'sent' then coalesce(sent_at, now()) else sent_at end,
    viewed_at = case when p_status = 'viewed' then coalesce(viewed_at, now()) else viewed_at end,
    signed_at = case when p_status = 'signed' then coalesce(signed_at, now()) else signed_at end,
    signatory_name = coalesce(p_signatory_name, signatory_name),
    signatory_email = coalesce(p_signatory_email, signatory_email),
    notes = case
      when p_note is not null and trim(p_note) <> '' then coalesce(notes || E'\n\n', '') || p_note
      else notes
    end
  where id = p_contract_id
  returning * into v_contract;

  if not found then
    raise exception 'contract_not_found';
  end if;

  perform public.log_activity(
    'contract',
    p_contract_id,
    'contract_status_changed',
    'Статус договора обновлён',
    coalesce(p_note, 'Новый статус: ' || p_status),
    jsonb_build_object('status', p_status, 'application_id', v_contract.application_id)
  );

  perform public.log_activity(
    'application',
    v_contract.application_id,
    'application_contract_status_changed',
    'Статус договора в заявке обновлён',
    coalesce(v_contract.contract_number, 'Договор') || ' → ' || p_status,
    jsonb_build_object('contract_id', p_contract_id, 'status', p_status)
  );

  return p_contract_id;
end;
$$;

create or replace function public.rotate_application_portal_token(
  p_application_id uuid,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  update public.applications
  set
    portal_access_token = gen_random_uuid(),
    portal_access_enabled = true,
    portal_access_expires_at = p_expires_at
  where id = p_application_id
  returning portal_access_token into v_token;

  if not found then
    raise exception 'application_not_found';
  end if;

  perform public.log_activity(
    'portal',
    p_application_id,
    'portal_token_rotated',
    'Ссылка кабинета родителя обновлена',
    'Старая ссылка должна считаться недействительной.',
    jsonb_build_object('application_id', p_application_id, 'expires_at', p_expires_at)
  );

  return v_token;
end;
$$;
