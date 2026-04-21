# Сквозной тест процесса

1. Создать или импортировать лид в разделе `/dashboard/leads`.
2. Конвертировать лид в сделку или создать сделку вручную в `/dashboard/deals`.
3. Открыть карточку сделки и заполнить связи: аккаунт, программа, выезд, партнёр.
4. В карточке сделки создать заявку участника (`#create-application`).
5. Открыть карточку заявки и:
   - назначить/проверить выезд,
   - создать договор (`#create-contract`),
   - создать платёж (`#create-payment`),
   - создать чек-лист документов.
6. Перейти в `/dashboard/contracts?application_id=...` и проверить, что договор появился и связан с заявкой и сделкой.
7. Перейти в `/dashboard/finance?application_id=...` и проверить, что платёж появился и связан с заявкой и сделкой.
8. Отметить платёж как оплаченный ролью `finance` или `owner`.
9. Проверить `/dashboard/controlling` и карточку выезда: выручка должна попасть в paid revenue.
10. Проверить `/dashboard/departures/[id]` и `/dashboard/ops/[id]`: участник должен быть виден в выезде и операционке.

## Быстрые входы
- Создать платёж из меню: `/dashboard/finance?create=payment`
- Добавить расход: `/dashboard/controlling?create=expense#create-expense`
- Создать заявку из сделки: `/dashboard/deals/[id]#create-application`
- Создать договор из заявки: `/dashboard/applications/[id]#create-contract`
- Создать платёж из заявки: `/dashboard/applications/[id]#create-payment`
