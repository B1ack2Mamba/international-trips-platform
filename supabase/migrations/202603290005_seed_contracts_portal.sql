insert into public.contract_templates (code, title, segment, locale, body_template, metadata)
values
  (
    'family_standard',
    'Договор на участие в международной программе',
    null,
    'ru',
    $template$
ДОГОВОР № {{contract_number}}
Дата формирования: {{generated_date_display}}

Стороны:
1. Организатор программы оформляет участие {{participant_name}} в международной программе.
2. Заказчик / родитель: {{guardian_name}}.
Контакты заказчика: {{guardian_phone}}, {{guardian_email}}.

Предмет:
Участник {{participant_name}} зачисляется на программу «{{program_title}}».
Страна / город: {{program_country}}, {{program_city}}.
Выезд: {{departure_name}}.
Даты поездки: {{trip_dates_display}}.

Финансовые условия:
Полная стоимость участия: {{amount_total_display}} {{currency}}.
Получено оплат: {{amount_paid_display}} {{currency}}.
Остаток к оплате: {{amount_due_display}} {{currency}}.

Порядок взаимодействия:
1. Заказчик предоставляет документы и данные в сроки, обозначенные организатором.
2. Организатор координирует программу, документы, логистику и коммуникацию по выезду.
3. Финальная программа, дедлайны и инструкции направляются в личный кабинет родителя.

Подтверждение:
Заказчик подтверждает, что ознакомился с программой, сроками и финансовыми условиями.

Заказчик: {{guardian_name}}
Участник: {{participant_name}}
Программа: {{program_title}}
$template$,
    jsonb_build_object('seed', true, 'audience', 'family')
  ),
  (
    'business_standard',
    'Договор на деловую международную программу',
    'business',
    'ru',
    $template$
ДОГОВОР № {{contract_number}}
Дата формирования: {{generated_date_display}}

Заказчик: {{guardian_name}}
Контакты: {{guardian_phone}}, {{guardian_email}}

Программа: {{program_title}}
Локация: {{program_country}}, {{program_city}}
Маршрут / выезд: {{departure_name}}
Даты: {{trip_dates_display}}

Стоимость участия: {{amount_total_display}} {{currency}}
Оплачено: {{amount_paid_display}} {{currency}}
Остаток: {{amount_due_display}} {{currency}}

Организатор обеспечивает координацию программы, график деловых визитов, информационное сопровождение и операционную коммуникацию по поездке.
$template$,
    jsonb_build_object('seed', true, 'audience', 'business')
  )
on conflict (code) do update set
  title = excluded.title,
  segment = excluded.segment,
  locale = excluded.locale,
  body_template = excluded.body_template,
  metadata = excluded.metadata,
  is_active = true;

insert into public.application_documents (application_id, code, title, status, sort_order)
select a.id, v.code, v.title, v.status, v.sort_order
from public.applications a
cross join (
  values
    ('passport_scan', 'Скан паспорта участника', 'requested', 10),
    ('guardian_passport', 'Скан паспорта родителя / плательщика', 'requested', 20),
    ('photo', 'Фото на визу / анкету', 'requested', 30),
    ('consent', 'Нотариальное согласие / разрешение', 'requested', 40),
    ('medical_form', 'Медицинская форма / страховка', 'requested', 50),
    ('flight_data', 'Данные по перелёту / бронированию', 'requested', 60)
) as v(code, title, status, sort_order)
on conflict (application_id, code) do nothing;

update public.application_documents
set status = 'uploaded', notes = coalesce(notes, 'Seed: файл получен, ждёт проверки')
where application_id = (select id from public.applications where participant_name = 'Мария Смирнова' limit 1)
  and code in ('passport_scan', 'guardian_passport', 'photo');

update public.application_documents
set status = 'verified', notes = coalesce(notes, 'Seed: проверено')
where application_id = (select id from public.applications where participant_name = 'Дмитрий Орлов' limit 1);

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
  metadata,
  sent_at
)
select
  a.id,
  a.deal_id,
  d.account_id,
  t.id,
  'SEED-KOR-2026',
  'Договор / Мария Смирнова',
  'sent',
  'ru',
  payload.payload,
  public.apply_template(t.body_template, payload.payload),
  a.guardian_name,
  a.guardian_email,
  jsonb_build_object('seed', true, 'template_code', t.code),
  now()
from public.applications a
join public.deals d on d.id = a.deal_id
join public.departures dep on dep.id = coalesce(a.departure_id, d.departure_id)
join public.programs p on p.id = coalesce(d.program_id, dep.program_id)
join public.contract_templates t on t.code = 'family_standard'
cross join lateral (
  select jsonb_build_object(
    'contract_number', 'SEED-KOR-2026',
    'generated_date_display', to_char(current_date, 'DD.MM.YYYY'),
    'participant_name', coalesce(a.participant_name, '—'),
    'guardian_name', coalesce(a.guardian_name, '—'),
    'guardian_phone', coalesce(a.guardian_phone, '—'),
    'guardian_email', coalesce(a.guardian_email, '—'),
    'account_name', 'Семья Смирновых',
    'program_title', coalesce(p.title, '—'),
    'program_country', coalesce(p.country, '—'),
    'program_city', coalesce(p.city, '—'),
    'departure_name', coalesce(dep.departure_name, '—'),
    'departure_start_date_display', coalesce(to_char(dep.start_date, 'DD.MM.YYYY'), '—'),
    'departure_end_date_display', coalesce(to_char(dep.end_date, 'DD.MM.YYYY'), '—'),
    'trip_dates_display', coalesce(to_char(dep.start_date, 'DD.MM.YYYY'), '—') || ' — ' || coalesce(to_char(dep.end_date, 'DD.MM.YYYY'), '—'),
    'deal_title', coalesce(d.title, '—'),
    'amount_total_display', coalesce(a.amount_total::text, '0'),
    'amount_paid_display', coalesce(a.amount_paid::text, '0'),
    'amount_due_display', greatest(coalesce(a.amount_total, 0) - coalesce(a.amount_paid, 0), 0)::text,
    'currency', coalesce(dep.currency, d.currency, 'RUB')
  ) as payload
) payload
where a.participant_name = 'Мария Смирнова'
on conflict (contract_number) do nothing;

update public.applications
set current_contract_id = (
  select c.id from public.contracts c where c.contract_number = 'SEED-KOR-2026' limit 1
)
where participant_name = 'Мария Смирнова';
