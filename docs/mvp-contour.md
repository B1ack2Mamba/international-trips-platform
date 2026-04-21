# MVP contour: lead -> deal -> application -> payment

## Что добавлено в этой итерации
- `202603290003_workflows_activity.sql`
- `activity_log`
- workflow-функции:
  - `assign_lead_to_self(uuid)`
  - `update_lead_status(uuid, text, text, timestamptz)`
  - `convert_lead_to_deal(...)`
  - `update_deal_stage(uuid, text, text)`
  - `create_application_from_deal(...)`
  - `mark_payment_paid(uuid, numeric, timestamptz, text)`
- карточка лида `/dashboard/leads/[id]`
- карточка сделки `/dashboard/deals/[id]`
- фиксация оплаты из `/dashboard/finance`
- activity log на карточках лида и сделки

## Почему workflow-функции лежат в Postgres
Потому что здесь нужен **атомарный процесс**, а не набор клиентских запросов.

Если конвертация лида в сделку живёт только на фронте, рано или поздно ты получишь:
- аккаунт создался, а сделка нет
- сделка создалась, а лид не обновился
- задача не поставилась
- история действий потерялась

## Ручной smoke test
1. Создай owner-пользователя
2. Открой `/programs`
3. Отправь публичную заявку
4. Проверь `/dashboard/leads`
5. Открой лид и нажми `Взять лид в работу`
6. Сменить статус на `in_progress`
7. Конвертируй лид в сделку
8. Открой сделку и создай заявку участника
9. Проверь `/dashboard/finance`
10. Отметь платёж оплаченным
11. Проверь `/dashboard/applications`
12. Проверь `activity_log` в карточках
