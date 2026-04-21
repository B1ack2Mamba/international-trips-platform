insert into public.partner_referral_codes (partner_account_id, code, label, status, lock_days, commission_pct, landing_path, metadata)
select
  a.id,
  'lyceum-referral',
  'Лицей развития / базовый код',
  'active',
  180,
  12.50,
  '/programs',
  jsonb_build_object('seed', true)
from public.accounts a
where a.display_name = 'Лицей развития'
on conflict (code) do update set
  partner_account_id = excluded.partner_account_id,
  label = excluded.label,
  status = excluded.status,
  lock_days = excluded.lock_days,
  commission_pct = excluded.commission_pct,
  landing_path = excluded.landing_path,
  metadata = excluded.metadata;

update public.leads
set
  partner_account_id = (select id from public.accounts where display_name = 'Лицей развития' limit 1),
  partner_referral_code_id = (select id from public.partner_referral_codes where code = 'lyceum-referral' limit 1),
  ownership_lock_status = 'partner_owned',
  ownership_locked_until = now() + interval '180 days',
  ownership_note = 'Seed attribution from partner channel'
where source_channel = 'partner'
  and source_detail = 'lyceum-referral';

update public.deals
set
  partner_account_id = (select id from public.accounts where display_name = 'Лицей развития' limit 1),
  partner_referral_code_id = (select id from public.partner_referral_codes where code = 'lyceum-referral' limit 1),
  ownership_lock_status = 'partner_owned',
  ownership_locked_until = now() + interval '180 days',
  ownership_note = 'Seed attribution from partner lead'
where lead_id in (
  select id from public.leads where source_channel = 'partner' and source_detail = 'lyceum-referral'
);

update public.applications
set partner_account_id = (select id from public.accounts where display_name = 'Лицей развития' limit 1)
where deal_id in (
  select id from public.deals where partner_account_id = (select id from public.accounts where display_name = 'Лицей развития' limit 1)
);

insert into public.message_templates (code, channel, audience, title, subject_template, body_template, metadata)
values
  (
    'portal_access_code',
    'email',
    'family',
    'Код входа в кабинет семьи',
    'Код доступа для {{participant_name}}',
    'Здравствуйте, {{guardian_name}}.\n\nВаш код входа в кабинет семьи: {{access_code}}\nОн действует до {{expires_at_display}}.\n\nУчастник: {{participant_name}}\nПрограмма: {{program_title}}\nВыезд: {{departure_name}}',
    jsonb_build_object('seed', true)
  ),
  (
    'contract_ready',
    'email',
    'family',
    'Договор готов',
    'Договор готов для {{participant_name}}',
    'Здравствуйте, {{guardian_name}}.\n\nДоговор {{contract_number}} сформирован и доступен в кабинете семьи.\nПрограмма: {{program_title}}\nВыезд: {{departure_name}}\n\nПожалуйста, проверьте документ и подтвердите ознакомление.',
    jsonb_build_object('seed', true)
  ),
  (
    'document_rejected',
    'email',
    'family',
    'Нужно заменить документ',
    'Нужно обновить документ по заявке {{participant_name}}',
    'Здравствуйте, {{guardian_name}}.\n\nОдин из документов по заявке {{participant_name}} был отклонён.\nДокумент: {{document_title}}\nПричина: {{rejected_reason}}\n\nПожалуйста, загрузите новую версию в кабинете семьи.',
    jsonb_build_object('seed', true)
  ),
  (
    'payment_due',
    'email',
    'family',
    'Напоминание об оплате',
    'Напоминание об оплате для {{participant_name}}',
    'Здравствуйте, {{guardian_name}}.\n\nНапоминаем о платеже: {{payment_label}}\nСумма: {{payment_amount}} {{currency}}\nСрок: {{payment_due_date}}\n\nЕсли платёж уже проведён, просто ответьте на это письмо или сообщите менеджеру.',
    jsonb_build_object('seed', true)
  ),
  (
    'partner_lead_registered',
    'email',
    'partner',
    'Новый лид партнёра',
    'Новый лид по коду {{partner_code}}',
    'В систему вошёл новый лид.\nКонтакт: {{contact_name}}\nТелефон: {{phone}}\nПрограмма: {{program_title}}\nСтрана: {{desired_country}}',
    jsonb_build_object('seed', true)
  )
on conflict (code) do update set
  channel = excluded.channel,
  audience = excluded.audience,
  title = excluded.title,
  subject_template = excluded.subject_template,
  body_template = excluded.body_template,
  metadata = excluded.metadata,
  is_active = true;

-- Disabled in seed because SQL Editor / CLI execution may not have auth.uid(),
-- and repeated seed runs can create unnecessary noise in partner commissions.
-- Run this manually later under an owner/staff session if needed:
-- select public.sync_partner_commission_for_application(id)
-- from public.applications
-- where partner_account_id is not null;
