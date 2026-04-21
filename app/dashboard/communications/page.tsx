import { getMessageDispatchWebhookUrl, isMessageDispatchDryRun } from '@/lib/env'
import { formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { createClient } from '@/lib/supabase/server'
import { dispatchOutboxNowAction, queueApplicationTemplateAction, updateOutboxStatusAction } from './actions'

function getDispatcherMode() {
  if (getMessageDispatchWebhookUrl()) return 'webhook'
  if (isMessageDispatchDryRun()) return 'dry_run'
  return 'manual_only'
}

export default async function CommunicationsPage() {
  const supabase = await createClient()
  const [templatesRes, outboxRes] = await Promise.all([
    supabase.from('message_templates').select('id, code, channel, audience, title, is_active, created_at').order('code', { ascending: true }),
    supabase
      .from('message_outbox')
      .select('id, application_id, partner_account_id, channel, audience, template_code, recipient_name, recipient_email, subject, status, send_after, sent_at, created_at, last_error')
      .order('created_at', { ascending: false })
      .limit(60),
  ])

  const templates = templatesRes.data ?? []
  const outbox = outboxRes.data ?? []
  const queuedCount = outbox.filter((message) => message.status === 'queued' || message.status === 'processing').length
  const failedCount = outbox.filter((message) => message.status === 'failed').length
  const sentCount = outbox.filter((message) => message.status === 'sent').length
  const dispatcherMode = getDispatcherMode()

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Коммуникации</h1>
          <p className="muted">Outbox — это единая очередь коммуникаций: письма семье, партнёрам и внутренним ролям, а не хаотичный салат из чатов.</p>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="card kpi"><div className="kpi-label">Dispatcher mode</div><div className="kpi-value">{dispatcherMode}</div><div className="micro">webhook / dry_run / manual_only</div></article>
        <article className="card kpi"><div className="kpi-label">Queued</div><div className="kpi-value">{queuedCount}</div><div className="micro">ожидают отправки</div></article>
        <article className="card kpi"><div className="kpi-label">Ошибкаed</div><div className="kpi-value">{failedCount}</div><div className="micro">требуют внимания</div></article>
        <article className="card kpi"><div className="kpi-label">Sent</div><div className="kpi-value">{sentCount}</div><div className="micro">в последних 60 записях</div></article>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Поставить сообщение в очередь</h2>
          <form action={queueApplicationTemplateAction}>
            <div className="form-grid">
              <label>
                Application ID
                <input name="application_id" placeholder="uuid заявки" required />
              </label>
              <label>
                Шаблон
                <select name="template_code" defaultValue="contract_ready">
                  {templates.map((template) => (
                    <option key={template.id} value={template.code}>
                      {template.code} · {template.channel}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Отправить после
                <input name="send_after" type="datetime-local" />
              </label>
            </div>
            <div className="form-actions">
              <button className="button">Поставить в очередь</button>
            </div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Ручной запуск dispatcher</h2>
          <form action={dispatchOutboxNowAction}>
            <div className="form-grid">
              <label>
                Batch size
                <input name="limit" type="number" min="1" max="100" defaultValue="20" />
              </label>
            </div>
            <div className="form-actions">
              <button className="button-secondary">Обработать очередь сейчас</button>
            </div>
          </form>
          <div className="notice">Для Vercel можно повесить этот же dispatch на cron route `/api/cron/message-dispatch` и закрыть его `CRON_SECRET`.</div>
        </article>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Активные шаблоны</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Channel</th>
                  <th>Audience</th>
                  <th>Название</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>{template.code}</td>
                    <td>{template.channel}</td>
                    <td>{template.audience}</td>
                    <td>{template.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Как это едет</h2>
          <div className="notice">1. CRM ставит сообщение в `message_outbox`.</div>
          <div className="notice">2. Dispatcher забирает due-сообщения и помечает их `processing`.</div>
          <div className="notice">3. Дальше запись уходит в webhook-адаптер или dry-run слой.</div>
          <div className="notice">4. После успешной доставки сообщение получает статус `sent`, иначе `failed`.</div>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Исходящие сообщения</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Получатель</th>
                <th>Шаблон</th>
                <th>Канал</th>
                <th>Статус</th>
                <th>Очередь</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {outbox.map((message) => (
                <tr key={message.id}>
                  <td>
                    <div>{message.recipient_name || 'Без имени'}</div>
                    <div className="micro">{message.recipient_email || '—'}</div>
                  </td>
                  <td>
                    <div>{message.template_code || 'вручную'}</div>
                    <div className="micro">{message.subject || 'Без темы'}</div>
                  </td>
                  <td>{label('channel', message.channel)}</td>
                  <td>
                    <div>{label('outboxStatus', message.status)}</div>
                    <div className="micro">{message.last_error || '—'}</div>
                  </td>
                  <td>
                    <div>{formatDateTime(message.send_after)}</div>
                    <div className="micro">создано {formatDateTime(message.created_at)}</div>
                  </td>
                  <td>
                    <div className="form-actions">
                      <form action={updateOutboxStatusAction}>
                        <input type="hidden" name="message_id" value={message.id} />
                        <input type="hidden" name="status" value="sent" />
                        <button className="button-secondary">Отметить отправленным</button>
                      </form>
                      <form action={updateOutboxStatusAction}>
                        <input type="hidden" name="message_id" value={message.id} />
                        <input type="hidden" name="status" value="failed" />
                        <input type="hidden" name="last_error" value="manual_fail" />
                        <button className="button-secondary">Ошибка</button>
                      </form>
                      <form action={updateOutboxStatusAction}>
                        <input type="hidden" name="message_id" value={message.id} />
                        <input type="hidden" name="status" value="queued" />
                        <button className="button-secondary">Вернуть в очередь</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
