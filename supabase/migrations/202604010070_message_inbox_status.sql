alter table public.message_inbox
  add column if not exists status text not null default 'unread',
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references public.profiles(id) on delete set null;

alter table public.message_inbox
  drop constraint if exists message_inbox_status_check;

alter table public.message_inbox
  add constraint message_inbox_status_check
  check (status in ('unread','read','handled'));

create index if not exists idx_message_inbox_status on public.message_inbox(lead_id, status, received_at desc);
