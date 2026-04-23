create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  provider text not null default 'exolve',
  provider_call_id text,
  provider_call_sid text,
  direction text not null,
  status text not null default 'initiated',
  source_number text,
  destination_number text,
  display_number text,
  request_description text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  recording_expires_at timestamptz,
  recording_duration_seconds integer,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint call_logs_direction_check check (direction in ('inbound','outbound','callback')),
  constraint call_logs_status_check check (status in ('initiated','ringing','answered','missed','completed','failed','recording_ready','transcription_ready','speech_analytics_ready')),
  constraint call_logs_duration_check check (duration_seconds is null or duration_seconds >= 0)
);

create unique index if not exists idx_call_logs_provider_call_id
  on public.call_logs(provider, provider_call_id)
  where provider_call_id is not null;

create index if not exists idx_call_logs_lead_created on public.call_logs(lead_id, created_at desc);
create index if not exists idx_call_logs_owner_status on public.call_logs(owner_user_id, status, created_at desc);
create index if not exists idx_call_logs_provider_sid on public.call_logs(provider, provider_call_sid);

drop trigger if exists set_call_logs_updated_at on public.call_logs;
create trigger set_call_logs_updated_at before update on public.call_logs for each row execute procedure public.set_updated_at();

alter table public.call_logs enable row level security;

drop policy if exists "staff_manage_call_logs" on public.call_logs;
create policy "staff_manage_call_logs"
  on public.call_logs for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
