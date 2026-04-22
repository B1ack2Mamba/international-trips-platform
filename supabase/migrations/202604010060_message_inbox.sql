create table if not exists public.message_inbox (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  partner_account_id uuid references public.accounts(id) on delete set null,
  channel text not null,
  audience text not null default 'family',
  sender_name text,
  sender_email text,
  sender_phone text,
  subject text,
  body text not null,
  provider text,
  external_message_id text,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_inbox_channel_check check (channel in ('email','telegram','whatsapp','sms','internal')),
  constraint message_inbox_audience_check check (audience in ('family','staff','partner','system'))
);

create index if not exists idx_message_inbox_lead on public.message_inbox(lead_id, received_at desc);
create index if not exists idx_message_inbox_deal on public.message_inbox(deal_id, received_at desc);
create index if not exists idx_message_inbox_application on public.message_inbox(application_id, received_at desc);
create unique index if not exists idx_message_inbox_provider_external
  on public.message_inbox(provider, external_message_id)
  where provider is not null and external_message_id is not null;

create trigger set_message_inbox_updated_at
  before update on public.message_inbox
  for each row execute procedure public.set_updated_at();

alter table public.message_inbox enable row level security;

create policy "staff_manage_message_inbox"
  on public.message_inbox for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
