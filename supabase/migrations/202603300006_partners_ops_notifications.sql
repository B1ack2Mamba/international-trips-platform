alter table public.activity_log
  drop constraint if exists activity_log_entity_type_check;

alter table public.activity_log
  add constraint activity_log_entity_type_check
  check (entity_type in ('lead','deal','application','payment','account','contract','document','portal','partner','departure','message','commission','system'));

alter table public.profiles
  add column if not exists partner_account_id uuid references public.accounts(id) on delete set null;

create index if not exists idx_profiles_partner_account on public.profiles(partner_account_id);

alter table public.leads
  add column if not exists partner_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists partner_referral_code_id uuid,
  add column if not exists ownership_lock_status text not null default 'none',
  add column if not exists ownership_locked_until timestamptz,
  add column if not exists ownership_note text;

alter table public.deals
  add column if not exists partner_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists partner_referral_code_id uuid,
  add column if not exists ownership_lock_status text not null default 'none',
  add column if not exists ownership_locked_until timestamptz,
  add column if not exists ownership_note text;

alter table public.applications
  add column if not exists partner_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists portal_auth_mode text not null default 'link';

alter table public.leads
  drop constraint if exists leads_ownership_lock_status_check;

alter table public.leads
  add constraint leads_ownership_lock_status_check
  check (ownership_lock_status in ('none','partner_owned','released','disputed'));

alter table public.deals
  drop constraint if exists deals_ownership_lock_status_check;

alter table public.deals
  add constraint deals_ownership_lock_status_check
  check (ownership_lock_status in ('none','partner_owned','released','disputed'));

alter table public.applications
  drop constraint if exists applications_portal_auth_mode_check;

alter table public.applications
  add constraint applications_portal_auth_mode_check
  check (portal_auth_mode in ('link','otp_required'));

create index if not exists idx_leads_partner_account on public.leads(partner_account_id, created_at desc);
create index if not exists idx_deals_partner_account on public.deals(partner_account_id, created_at desc);
create index if not exists idx_applications_partner_account on public.applications(partner_account_id, created_at desc);

create table if not exists public.partner_referral_codes (
  id uuid primary key default gen_random_uuid(),
  partner_account_id uuid not null references public.accounts(id) on delete cascade,
  code text not null unique,
  label text not null,
  status text not null default 'active',
  lock_days integer not null default 180,
  commission_pct numeric(5,2),
  landing_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_referral_codes_status_check check (status in ('active','paused','archived')),
  constraint partner_referral_codes_lock_days_check check (lock_days > 0),
  constraint partner_referral_codes_commission_check check (commission_pct is null or (commission_pct >= 0 and commission_pct <= 100))
);

create index if not exists idx_partner_referral_codes_partner on public.partner_referral_codes(partner_account_id, status);

alter table public.leads
  drop constraint if exists leads_partner_referral_code_fk;

alter table public.leads
  add constraint leads_partner_referral_code_fk
  foreign key (partner_referral_code_id) references public.partner_referral_codes(id) on delete set null;

alter table public.deals
  drop constraint if exists deals_partner_referral_code_fk;

alter table public.deals
  add constraint deals_partner_referral_code_fk
  foreign key (partner_referral_code_id) references public.partner_referral_codes(id) on delete set null;

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_account_id uuid not null references public.accounts(id) on delete cascade,
  referral_code_id uuid references public.partner_referral_codes(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  application_id uuid unique references public.applications(id) on delete cascade,
  status text not null default 'pending',
  base_amount numeric(12,2) not null default 0,
  commission_pct numeric(5,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  currency text not null default 'RUB',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_commissions_status_check check (status in ('pending','approved','paid','cancelled')),
  constraint partner_commissions_amounts_check check (base_amount >= 0 and commission_amount >= 0 and commission_pct >= 0 and commission_pct <= 100)
);

create index if not exists idx_partner_commissions_partner on public.partner_commissions(partner_account_id, status, created_at desc);
create index if not exists idx_partner_commissions_deal on public.partner_commissions(deal_id);

create table if not exists public.departure_ops_items (
  id uuid primary key default gen_random_uuid(),
  departure_id uuid not null references public.departures(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  owner_user_id uuid references public.profiles(id) on delete set null,
  category text not null,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  due_at timestamptz,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departure_ops_items_category_check check (category in ('group','visa','flights','hotel','insurance','briefing','documents','finance','safety','other')),
  constraint departure_ops_items_status_check check (status in ('todo','doing','blocked','done','cancelled')),
  constraint departure_ops_items_priority_check check (priority in ('low','medium','high','critical'))
);

create index if not exists idx_departure_ops_items_departure on public.departure_ops_items(departure_id, status, due_at);
create index if not exists idx_departure_ops_items_owner on public.departure_ops_items(owner_user_id, status, due_at);

create table if not exists public.trip_updates (
  id uuid primary key default gen_random_uuid(),
  departure_id uuid not null references public.departures(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  audience text not null default 'internal',
  title text not null,
  body text not null,
  is_published boolean not null default false,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_updates_audience_check check (audience in ('internal','family','partner'))
);

create index if not exists idx_trip_updates_departure on public.trip_updates(departure_id, created_at desc);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  channel text not null,
  audience text not null,
  title text not null,
  subject_template text,
  body_template text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_templates_channel_check check (channel in ('email','telegram','whatsapp','sms','internal')),
  constraint message_templates_audience_check check (audience in ('family','staff','partner','system'))
);

create table if not exists public.message_outbox (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  partner_account_id uuid references public.accounts(id) on delete set null,
  channel text not null,
  audience text not null,
  template_code text,
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  subject text,
  body text not null,
  status text not null default 'queued',
  provider text,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_outbox_channel_check check (channel in ('email','telegram','whatsapp','sms','internal')),
  constraint message_outbox_audience_check check (audience in ('family','staff','partner','system')),
  constraint message_outbox_status_check check (status in ('queued','processing','sent','failed','cancelled'))
);

create index if not exists idx_message_outbox_queue on public.message_outbox(status, send_after);
create index if not exists idx_message_outbox_application on public.message_outbox(application_id, created_at desc);

create table if not exists public.portal_login_codes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  email text not null,
  code_hash text not null,
  delivery_channel text not null default 'email',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint portal_login_codes_delivery_check check (delivery_channel in ('email','sms')),
  constraint portal_login_codes_attempts_check check (attempts >= 0)
);

create index if not exists idx_portal_login_codes_application on public.portal_login_codes(application_id, created_at desc);
create index if not exists idx_portal_login_codes_lookup on public.portal_login_codes(email, expires_at desc);

create table if not exists public.portal_sessions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_sessions_application on public.portal_sessions(application_id, expires_at desc);

create trigger set_partner_referral_codes_updated_at before update on public.partner_referral_codes for each row execute procedure public.set_updated_at();
create trigger set_partner_commissions_updated_at before update on public.partner_commissions for each row execute procedure public.set_updated_at();
create trigger set_departure_ops_items_updated_at before update on public.departure_ops_items for each row execute procedure public.set_updated_at();
create trigger set_trip_updates_updated_at before update on public.trip_updates for each row execute procedure public.set_updated_at();
create trigger set_message_templates_updated_at before update on public.message_templates for each row execute procedure public.set_updated_at();
create trigger set_message_outbox_updated_at before update on public.message_outbox for each row execute procedure public.set_updated_at();

alter table public.partner_referral_codes enable row level security;
alter table public.partner_commissions enable row level security;
alter table public.departure_ops_items enable row level security;
alter table public.trip_updates enable row level security;
alter table public.message_templates enable row level security;
alter table public.message_outbox enable row level security;
alter table public.portal_login_codes enable row level security;
alter table public.portal_sessions enable row level security;

create or replace function public.current_partner_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select partner_account_id from public.profiles where id = auth.uid()
$$;

create policy "staff_manage_partner_referral_codes"
  on public.partner_referral_codes for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "partner_read_own_referral_codes"
  on public.partner_referral_codes for select to authenticated
  using (partner_account_id = public.current_partner_account_id());

create policy "staff_manage_partner_commissions"
  on public.partner_commissions for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "partner_read_own_commissions"
  on public.partner_commissions for select to authenticated
  using (partner_account_id = public.current_partner_account_id());

create policy "staff_manage_departure_ops_items"
  on public.departure_ops_items for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_trip_updates"
  on public.trip_updates for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_message_templates"
  on public.message_templates for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_message_outbox"
  on public.message_outbox for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_portal_login_codes"
  on public.portal_login_codes for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "staff_manage_portal_sessions"
  on public.portal_sessions for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create or replace function public.sync_partner_commission_for_application(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
  v_commission_id uuid;
  v_commission_pct numeric(5,2);
  v_amount numeric(12,2);
  v_status text;
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;

  select
    a.id,
    a.deal_id,
    a.amount_total,
    a.partner_account_id,
    d.partner_referral_code_id,
    d.stage,
    d.currency,
    rc.commission_pct
  into v_app
  from public.applications a
  left join public.deals d on d.id = a.deal_id
  left join public.partner_referral_codes rc on rc.id = d.partner_referral_code_id
  where a.id = p_application_id;

  if not found then
    raise exception 'application_not_found';
  end if;

  if v_app.partner_account_id is null or v_app.commission_pct is null then
    return null;
  end if;

  v_commission_pct := coalesce(v_app.commission_pct, 0);
  v_amount := round(coalesce(v_app.amount_total, 0) * v_commission_pct / 100.0, 2);
  v_status := case
    when v_app.stage = 'lost' then 'cancelled'
    when v_app.stage = 'won' then 'approved'
    else 'pending'
  end;

  insert into public.partner_commissions (
    partner_account_id,
    referral_code_id,
    deal_id,
    application_id,
    status,
    base_amount,
    commission_pct,
    commission_amount,
    currency,
    metadata
  )
  values (
    v_app.partner_account_id,
    v_app.partner_referral_code_id,
    v_app.deal_id,
    p_application_id,
    v_status,
    coalesce(v_app.amount_total, 0),
    v_commission_pct,
    v_amount,
    coalesce(v_app.currency, 'RUB'),
    jsonb_build_object('source', 'sync_partner_commission_for_application')
  )
  on conflict (application_id)
  do update set
    partner_account_id = excluded.partner_account_id,
    referral_code_id = excluded.referral_code_id,
    deal_id = excluded.deal_id,
    status = excluded.status,
    base_amount = excluded.base_amount,
    commission_pct = excluded.commission_pct,
    commission_amount = excluded.commission_amount,
    currency = excluded.currency,
    metadata = coalesce(public.partner_commissions.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id into v_commission_id;

  perform public.log_activity(
    'commission',
    v_commission_id,
    'partner_commission_synced',
    'Пересчитана партнёрская комиссия',
    'Заявка ' || p_application_id::text,
    jsonb_build_object('application_id', p_application_id, 'amount', v_amount, 'pct', v_commission_pct)
  );

  return v_commission_id;
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
    partner_account_id,
    partner_referral_code_id,
    ownership_lock_status,
    ownership_locked_until,
    ownership_note,
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
    v_lead.partner_account_id,
    v_lead.partner_referral_code_id,
    v_lead.ownership_lock_status,
    v_lead.ownership_locked_until,
    v_lead.ownership_note,
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
    case when v_lead.partner_account_id is not null then 'Подготовить оффер и проверить партнёрский контур' else 'Подготовить оффер и следующий шаг по сделке' end,
    case when v_lead.partner_account_id is not null then 'Сделка пришла через партнёра. Проверьте условия, lock и коммуникацию без переманивания.' else 'Система автоматически создала задачу после конвертации лида в сделку.' end,
    'todo',
    'high',
    now() + interval '1 day',
    jsonb_build_object('source', 'convert_lead_to_deal', 'partner_account_id', v_lead.partner_account_id)
  );

  perform public.log_activity(
    'lead',
    p_lead_id,
    'lead_converted',
    'Лид конвертирован в сделку',
    p_title,
    jsonb_build_object('deal_id', v_deal_id, 'account_id', v_account_id, 'partner_account_id', v_lead.partner_account_id)
  );

  perform public.log_activity(
    'deal',
    v_deal_id,
    'deal_created_from_lead',
    'Сделка создана из лида',
    coalesce(v_lead.contact_name_raw, 'Без имени'),
    jsonb_build_object('lead_id', p_lead_id, 'account_id', v_account_id, 'partner_account_id', v_lead.partner_account_id)
  );

  if v_lead.partner_account_id is not null then
    perform public.log_activity(
      'partner',
      coalesce(v_lead.partner_account_id, v_deal_id),
      'partner_lead_converted',
      'Партнёрский лид переведён в сделку',
      p_title,
      jsonb_build_object('lead_id', p_lead_id, 'deal_id', v_deal_id, 'partner_account_id', v_lead.partner_account_id)
    );
  end if;

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

  update public.partner_commissions
  set status = case when p_stage = 'lost' then 'cancelled' when p_stage = 'won' then 'approved' else 'pending' end
  where deal_id = p_deal_id;

  perform public.log_activity(
    'deal',
    p_deal_id,
    'deal_stage_changed',
    'Стадия сделки обновлена',
    coalesce(p_note, 'Новая стадия: ' || p_stage),
    jsonb_build_object('stage', p_stage, 'partner_account_id', v_deal.partner_account_id)
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
    partner_account_id,
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
    v_deal.partner_account_id,
    p_participant_name,
    p_guardian_name,
    p_guardian_phone,
    p_guardian_email,
    'draft',
    v_total,
    0,
    jsonb_build_object('created_from', 'deal', 'deal_id', p_deal_id, 'partner_account_id', v_deal.partner_account_id)
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
    jsonb_build_object('source', 'create_application_from_deal', 'partner_account_id', v_deal.partner_account_id)
  );

  if v_deal.partner_account_id is not null then
    perform public.sync_partner_commission_for_application(v_application_id);
  end if;

  perform public.log_activity(
    'deal',
    p_deal_id,
    'application_created',
    'Из сделки создана заявка',
    p_participant_name,
    jsonb_build_object('application_id', v_application_id, 'partner_account_id', v_deal.partner_account_id)
  );

  perform public.log_activity(
    'application',
    v_application_id,
    'application_created',
    'Создана заявка на поездку',
    p_participant_name,
    jsonb_build_object('deal_id', p_deal_id, 'partner_account_id', v_deal.partner_account_id)
  );

  return v_application_id;
end;
$$;

drop view if exists public.reporting_funnel_summary;
create view public.reporting_funnel_summary as
select
  count(*) filter (where status in ('new','assigned','in_progress','qualified')) as active_leads,
  count(*) filter (where status = 'duplicate') as duplicate_leads,
  (select count(*) from public.deals where stage in ('qualified','proposal','negotiation','won')) as active_deals,
  (select count(*) from public.deals where stage = 'won') as won_deals,
  (select count(*) from public.applications where status not in ('cancelled')) as active_applications,
  (select coalesce(sum(amount), 0) from public.payments where status = 'paid') as paid_revenue,
  (select count(*) from public.message_outbox where status in ('queued','processing')) as queued_messages,
  (select count(*) from public.partner_commissions where status in ('pending','approved')) as partner_liabilities
from public.leads;

drop view if exists public.reporting_partner_performance;
create view public.reporting_partner_performance as
select
  a.id as partner_account_id,
  a.display_name as partner_name,
  count(distinct l.id) as leads_count,
  count(distinct d.id) as deals_count,
  count(distinct app.id) as applications_count,
  coalesce(sum(app.amount_total), 0)::numeric(12,2) as booked_amount,
  coalesce(sum(pc.commission_amount) filter (where pc.status in ('pending','approved','paid')), 0)::numeric(12,2) as commission_amount,
  max(l.created_at) as last_lead_at
from public.accounts a
left join public.leads l on l.partner_account_id = a.id
left join public.deals d on d.partner_account_id = a.id
left join public.applications app on app.partner_account_id = a.id
left join public.partner_commissions pc on pc.partner_account_id = a.id
where a.account_type = 'partner'
group by a.id, a.display_name;

drop view if exists public.reporting_departure_ops;
create view public.reporting_departure_ops as
select
  dep.id as departure_id,
  dep.departure_name,
  dep.start_date,
  dep.end_date,
  dep.status as departure_status,
  p.title as program_title,
  count(distinct app.id) as applications_count,
  count(doi.id) as ops_items_total,
  count(doi.id) filter (where doi.status = 'done') as ops_items_done,
  count(doi.id) filter (where doi.status in ('todo','doing','blocked')) as ops_items_open,
  coalesce(round(case when count(doi.id) = 0 then 0 else (count(doi.id) filter (where doi.status = 'done'))::numeric / count(doi.id)::numeric * 100 end), 0) as ops_completion_pct
from public.departures dep
left join public.programs p on p.id = dep.program_id
left join public.applications app on app.departure_id = dep.id
left join public.departure_ops_items doi on doi.departure_id = dep.id
group by dep.id, dep.departure_name, dep.start_date, dep.end_date, dep.status, p.title;

grant execute on function public.current_partner_account_id() to authenticated;
grant execute on function public.sync_partner_commission_for_application(uuid) to authenticated;
