insert into public.programs (code, title, country, city, segment, trip_type, language, duration_days, short_description, description, public_slug)
values
  (
    'CHN-SUMMER-2026',
    'Китай: язык и технологии',
    'Китай',
    'Сиань',
    'teen',
    'language-immersion',
    'Китайский',
    14,
    '2 недели языка, кампуса, технологических визитов и культурной среды.',
    'Интенсив китайского языка, кампус-погружение, визиты в технологические компании, экскурсии и практика коммуникации.',
    'china-tech-immersion'
  ),
  (
    'KOR-TEEN-2026',
    'Корея: язык, дизайн и инновации',
    'Южная Корея',
    'Сеул',
    'teen',
    'language-immersion',
    'Корейский',
    14,
    'Язык, кампус, техно- и культурный маршрут в Сеуле.',
    'Две недели с языковой школой, музеями, современными кварталами и встречами с образовательными центрами.',
    'korea-language-innovation'
  ),
  (
    'UK-BIZ-2026',
    'Англия: business English и деловые визиты',
    'Великобритания',
    'Лондон',
    'business',
    'business-tour',
    'Английский',
    10,
    'Business English, встречи и деловая среда Лондона.',
    'Программа для предпринимателей и старших студентов: бизнес-английский, визиты в компании и отраслевые события.',
    'uk-business-english'
  )
on conflict (code) do nothing;

insert into public.departures (program_id, departure_name, city, start_date, end_date, application_deadline, seat_capacity, status, base_price, currency)
values
  (
    (select id from public.programs where code = 'CHN-SUMMER-2026' limit 1),
    'Июль 2026 / Сиань',
    'Сиань',
    '2026-07-06',
    '2026-07-19',
    '2026-05-20',
    20,
    'selling',
    185000,
    'RUB'
  ),
  (
    (select id from public.programs where code = 'KOR-TEEN-2026' limit 1),
    'Август 2026 / Сеул',
    'Сеул',
    '2026-08-03',
    '2026-08-16',
    '2026-06-15',
    18,
    'published',
    210000,
    'RUB'
  ),
  (
    (select id from public.programs where code = 'UK-BIZ-2026' limit 1),
    'Октябрь 2026 / Лондон',
    'Лондон',
    '2026-10-05',
    '2026-10-14',
    '2026-08-30',
    12,
    'selling',
    3200,
    'GBP'
  )
on conflict do nothing;

insert into public.accounts (display_name, account_type, status, city, country, notes)
values
  ('Семья Ивановых', 'family', 'active', 'Пенза', 'Россия', 'Интересуются программой в Китай.'),
  ('Лицей развития', 'school', 'active', 'Москва', 'Россия', 'Партнёрская школа для групповых выездов.')
on conflict do nothing;

insert into public.leads (desired_program_id, desired_departure_id, source_channel, source_detail, contact_name_raw, phone_raw, email_raw, desired_country, status, message)
values
  (
    (select id from public.programs where code = 'CHN-SUMMER-2026' limit 1),
    (select id from public.departures where departure_name = 'Июль 2026 / Сиань' limit 1),
    'website',
    'china-tech-immersion',
    'Анна Иванова',
    '+79001234567',
    'anna@example.com',
    'Китай',
    'new',
    'Ищем безопасную программу для подростка 15 лет.'
  ),
  (
    (select id from public.programs where code = 'KOR-TEEN-2026' limit 1),
    (select id from public.departures where departure_name = 'Август 2026 / Сеул' limit 1),
    'partner',
    'lyceum-referral',
    'Ольга Смирнова',
    '+79007654321',
    'olga@example.com',
    'Южная Корея',
    'qualified',
    'Готовы к созвону с родителями на этой неделе.'
  ),
  (
    (select id from public.programs where code = 'UK-BIZ-2026' limit 1),
    (select id from public.departures where departure_name = 'Октябрь 2026 / Лондон' limit 1),
    'telegram',
    'china_business_and_life',
    'Дмитрий Орлов',
    '+79005554433',
    'd.orlov@example.com',
    'Великобритания',
    'in_progress',
    'Интерес к business English для предпринимателя.'
  )
on conflict do nothing;

insert into public.deals (lead_id, title, stage, estimated_value, currency, participants_count, close_date, notes)
values
  (
    (select id from public.leads where contact_name_raw = 'Ольга Смирнова' limit 1),
    'Корея / Смирновы / август 2026',
    'proposal',
    210000,
    'RUB',
    1,
    '2026-04-20',
    'Нужен оффер с проживанием и куратором.'
  ),
  (
    (select id from public.leads where contact_name_raw = 'Дмитрий Орлов' limit 1),
    'Англия / Орлов / business tour',
    'negotiation',
    3200,
    'GBP',
    1,
    '2026-05-15',
    'Сравнивает с альтернативой от лондонского провайдера.'
  )
on conflict do nothing;

insert into public.applications (deal_id, departure_id, participant_name, guardian_name, guardian_phone, guardian_email, status, documents_ready, visa_status, amount_total, amount_paid, notes)
values
  (
    (select id from public.deals where title = 'Корея / Смирновы / август 2026' limit 1),
    (select id from public.departures where departure_name = 'Август 2026 / Сеул' limit 1),
    'Мария Смирнова',
    'Ольга Смирнова',
    '+79007654321',
    'olga@example.com',
    'docs',
    false,
    'not_started',
    210000,
    50000,
    'Собирают пакет документов на визу.'
  ),
  (
    (select id from public.deals where title = 'Англия / Орлов / business tour' limit 1),
    (select id from public.departures where departure_name = 'Октябрь 2026 / Лондон' limit 1),
    'Дмитрий Орлов',
    'Дмитрий Орлов',
    '+79005554433',
    'd.orlov@example.com',
    'ready',
    true,
    'not_required',
    3200,
    1600,
    'Ожидается финальный платёж после бронирования перелёта.'
  )
on conflict do nothing;

insert into public.payments (deal_id, application_id, external_payment_id, payer_name, label, amount, currency, due_date, status)
values
  (
    (select id from public.deals where title = 'Корея / Смирновы / август 2026' limit 1),
    (select id from public.applications where participant_name = 'Мария Смирнова' limit 1),
    'seed-kor-deposit',
    'Ольга Смирнова',
    'Депозит за программу Корея',
    50000,
    'RUB',
    '2026-04-10',
    'partial'
  ),
  (
    (select id from public.deals where title = 'Корея / Смирновы / август 2026' limit 1),
    (select id from public.applications where participant_name = 'Мария Смирнова' limit 1),
    'seed-kor-final',
    'Ольга Смирнова',
    'Финальный платёж Корея',
    160000,
    'RUB',
    '2026-05-25',
    'due'
  ),
  (
    (select id from public.deals where title = 'Англия / Орлов / business tour' limit 1),
    (select id from public.applications where participant_name = 'Дмитрий Орлов' limit 1),
    'seed-uk-balance',
    'Дмитрий Орлов',
    'Баланс по business tour',
    1600,
    'GBP',
    '2026-06-01',
    'pending'
  )
on conflict (external_payment_id) do nothing;

insert into public.sales_scripts (segment, stage, title, body)
values
  (
    'teen',
    'first-call',
    'Первичный звонок родителю',
    '1. Выясняем цель поездки. 2. Калибруем страхи по безопасности. 3. Показываем структуру программы. 4. Закрываем на следующий шаг и дедлайн.'
  ),
  (
    'teen',
    'follow-up',
    'Дожим после презентации программы',
    '1. Напоминаем цель ребёнка. 2. Возвращаемся к ценности поездки. 3. Даём дедлайн и ближайший выезд. 4. Фиксируем следующий шаг.'
  ),
  (
    'business',
    'qualification',
    'Квалификация предпринимателя на business tour',
    '1. Выяснить бизнес-цель. 2. Понять уровень английского и формат встреч. 3. Уточнить дедлайны и бюджет. 4. Перевести в персональный оффер.'
  )
on conflict do nothing;

insert into public.tasks (title, description, status, priority, due_date)
values
  (
    'Перезвонить Анне Ивановой',
    'Уточнить возраст ребёнка и желаемые даты поездки.',
    'todo',
    'high',
    now() + interval '1 day'
  ),
  (
    'Подготовить оффер Смирновым',
    'Собрать PDF-оффер с проживанием, куратором и дедлайнами оплат.',
    'doing',
    'critical',
    now() + interval '2 days'
  ),
  (
    'Проверить статус оплаты Орлова',
    'Созвониться и подтвердить срок перевода финального платежа.',
    'todo',
    'medium',
    now() + interval '3 days'
  )
on conflict do nothing;
