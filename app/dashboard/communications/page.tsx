import { getMessageDispatchWebhookUrl, isMessageDispatchDryRun } from '@/lib/env'
import { getExolveConfigState } from '@/lib/exolve'
import { formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { getRecentCallLogs } from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import { dispatchOutboxNowAction, markInboxHandledAction, queueApplicationTemplateAction, queueManualMessageAction, updateOutboxStatusAction } from './actions'

function getDispatcherMode() {
  if (getMessageDispatchWebhookUrl()) return 'webhook'
  if (isMessageDispatchDryRun()) return 'dry_run'
  return 'manual_only'
}

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const statusFilter = typeof params.status === 'string' ? params.status : ''
  const supabase = await createClient()
  const [templatesRes, outboxRes, inboxRes, callLogs] = await Promise.all([
    supabase.from('message_templates').select('id, code, channel, audience, title, is_active, created_at').order('code', { ascending: true }),
    supabase
      .from('message_outbox')
      .select('id, lead_id, application_id, partner_account_id, channel, audience, template_code, recipient_name, recipient_email, recipient_phone, subject, body, status, send_after, sent_at, created_at, last_error')
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('message_inbox')
      .select('id, lead_id, deal_id, application_id, channel, sender_name, sender_email, sender_phone, subject, body, status, provider, received_at, created_at, lead:leads(id, contact_name_raw, phone_raw, email_raw)')
      .order('created_at', { ascending: false })
      .limit(60),
    getRecentCallLogs(60),
  ])

  const templates = templatesRes.data ?? []
  const allOutbox = outboxRes.data ?? []
  const allInbox = inboxRes.data ?? []
  const outbox = statusFilter ? allOutbox.filter((message) => message.status === statusFilter) : allOutbox
  const queuedCount = outbox.filter((message) => message.status === 'queued' || message.status === 'processing').length
  const failedCount = outbox.filter((message) => message.status === 'failed').length
  const sentCount = outbox.filter((message) => message.status === 'sent').length
  const inboxOpenCount = allInbox.filter((message) => message.status !== 'handled').length
  const inboxHandledCount = allInbox.filter((message) => message.status === 'handled').length
  const dispatcherMode = getDispatcherMode()
  const exolveConfig = getExolveConfigState()
  const missedCalls = callLogs.filter((call) => call.status === 'missed').length
  const failedCalls = callLogs.filter((call) => call.status === 'failed').length

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
        <article className="card kpi"><div className="kpi-label">Требуют ответа</div><div className="kpi-value">{inboxOpenCount}</div><div className="micro">входящие сообщения</div></article>
        <article className="card kpi"><div className="kpi-label">Queued</div><div className="kpi-value">{queuedCount}</div><div className="micro">ожидают отправки</div></article>
        <article className="card kpi"><div className="kpi-label">Ошибки</div><div className="kpi-value">{failedCount}</div><div className="micro">требуют внимания</div></article>
        <article className="card kpi"><div className="kpi-label">Sent</div><div className="kpi-value">{sentCount}</div><div className="micro">в последних 60 записях</div></article>
      </section>

      <article className="card stack">
        <div className="section-mini-head">
          <div>
            <h2>IP-телефония Exolve</h2>
            <div className="micro">Журнал входящих, callback-звонков, пропущенных звонков и записей разговоров.</div>
          </div>
          <div className="compact-badges">
            <span className={`badge ${exolveConfig.hasApiKey && exolveConfig.hasNumberCode && exolveConfig.hasResourceId ? 'success' : 'danger'}`}>API: {exolveConfig.hasApiKey ? 'ключ есть' : 'нет ключа'}</span>
            <span className={`badge ${missedCalls ? 'danger' : 'success'}`}>Пропущено: {missedCalls}</span>
            <span className={`badge ${failedCalls ? 'danger' : ''}`}>Ошибки: {failedCalls}</span>
          </div>
        </div>
        <div className="notice">Webhook для Exolve: `/api/exolve/call-events`. Если зададите `EXOLVE_WEBHOOK_TOKEN`, передавайте его как Bearer token, `x-exolve-token` или query `?token=...`.</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Звонок</th>
                <th>Статус</th>
                <th>Когда</th>
                <th>Запись</th>
              </tr>
            </thead>
            <tbody>
              {callLogs.map((call) => {
                const lead = Array.isArray(call.lead) ? (call.lead[0] ?? null) : call.lead
                return (
                  <tr key={call.id} className={call.status === 'missed' || call.status === 'failed' ? 'attention-row' : ''}>
                    <td>
                      <div>{lead?.contact_name_raw || call.display_number || 'Без клиента'}</div>
                      <div className="micro">{lead?.phone_raw || (call.display_number ? `+${call.display_number}` : '—')}</div>
                    </td>
                    <td>
                      <div>{call.direction === 'callback' ? 'Callback' : call.direction === 'inbound' ? 'Входящий' : 'Исходящий'}</div>
                      <div className="micro">{call.source_number ? `+${call.source_number}` : '—'} → {call.destination_number ? `+${call.destination_number}` : '—'}</div>
                    </td>
                    <td>
                      <span className={`badge ${call.status === 'missed' || call.status === 'failed' ? 'danger' : call.status === 'completed' || call.status === 'answered' ? 'success' : ''}`}>{call.status}</span>
                      {call.last_error ? <div className="micro">{call.last_error}</div> : null}
                    </td>
                    <td>{formatDateTime(call.started_at || call.created_at)}</td>
                    <td>{call.recording_url ? <a href={call.recording_url} target="_blank" rel="noreferrer">Открыть</a> : '—'}</td>
                  </tr>
                )
              })}
              {!callLogs.length ? <tr><td colSpan={5}>Звонков пока нет.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card stack">
        <div className="section-mini-head">
          <div>
            <h2>Входящие ответы</h2>
            <div className="micro">Ответы клиентов из email/мессенджеров и ручные входящие из карточек. Открытые сообщения создают задачи менеджерам.</div>
          </div>
          <div className="compact-badges">
            <span className={`badge ${inboxOpenCount ? 'danger' : 'success'}`}>Ответить: {inboxOpenCount}</span>
            <span className="badge">Отработано: {inboxHandledCount}</span>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table communications-inbox-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Канал</th>
                <th>Сообщение</th>
                <th>Получено</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {allInbox.map((message) => {
                const lead = Array.isArray(message.lead) ? (message.lead[0] ?? null) : message.lead
                return (
                  <tr key={message.id} className={message.status === 'handled' ? '' : 'attention-row'}>
                    <td>
                      <div>{message.sender_name || lead?.contact_name_raw || 'Без имени'}</div>
                      <div className="micro">{message.sender_email || message.sender_phone || lead?.email_raw || lead?.phone_raw || '—'}</div>
                    </td>
                    <td>
                      <div>{label('channel', message.channel)}</div>
                      <div className="micro">{message.provider || 'manual'}</div>
                    </td>
                    <td>
                      <div>{message.subject || 'Без темы'}</div>
                      <div className="micro outbox-body-preview">{message.body}</div>
                      <div className="micro">{message.status === 'handled' ? 'отработано' : 'требует ответа'}</div>
                    </td>
                    <td>{formatDateTime(message.received_at || message.created_at)}</td>
                    <td>
                      <div className="form-actions">
                        {message.lead_id ? <a className="button-secondary" href={`/dashboard/my-leads?open=${message.lead_id}#lead-communications`}>Открыть клиента</a> : null}
                        {message.status !== 'handled' ? (
                          <form action={markInboxHandledAction}>
                            <input type="hidden" name="message_id" value={message.id} />
                            <input type="hidden" name="lead_id" value={message.lead_id || ''} />
                            <button className="button-secondary">Отработано</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!allInbox.length ? (
                <tr><td colSpan={5}>Входящих сообщений пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Ручное сообщение</h2>
          <form action={queueManualMessageAction}>
            <div className="form-grid">
              <label>Получатель<input name="recipient_name" placeholder="Анна Иванова" /></label>
              <label>Email<input name="recipient_email" type="email" placeholder="client@example.com" /></label>
              <label>Телефон<input name="recipient_phone" placeholder="+7..." /></label>
              <label>
                Канал
                <select name="channel" defaultValue="email">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                  <option value="sms">SMS</option>
                  <option value="internal">Внутреннее</option>
                </select>
              </label>
              <label>
                Аудитория
                <select name="audience" defaultValue="family">
                  <option value="family">Семья</option>
                  <option value="staff">Команда</option>
                  <option value="partner">Партнёр</option>
                  <option value="system">Система</option>
                </select>
              </label>
              <label>Отправить после<input name="send_after" type="datetime-local" /></label>
              <label className="communications-subject-field">Тема<input name="subject" placeholder="Следующий шаг по поездке" /></label>
              <label className="communications-body-field">Текст<textarea name="body" placeholder="Текст сообщения клиенту или команде" required /></label>
            </div>
            <div className="form-actions">
              <button className="button">Поставить в очередь</button>
            </div>
          </form>
        </article>

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
        <div className="section-mini-head">
          <h2>Исходящие сообщения</h2>
          <form className="inline-filter-form" action="/dashboard/communications">
            <select name="status" defaultValue={statusFilter}>
              <option value="">Все статусы</option>
              <option value="queued">В очереди</option>
              <option value="processing">Обрабатывается</option>
              <option value="sent">Отправлено</option>
              <option value="failed">Ошибка</option>
              <option value="cancelled">Отменено</option>
            </select>
            <button className="button-secondary">Показать</button>
          </form>
        </div>
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
                    <div className="micro">{message.recipient_email || message.recipient_phone || '—'}</div>
                  </td>
                  <td>
                    <div>{message.template_code || 'вручную'}</div>
                    <div className="micro">{message.subject || 'Без темы'}</div>
                    <div className="micro outbox-body-preview">{message.body}</div>
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
