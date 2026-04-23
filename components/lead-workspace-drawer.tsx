import Link from 'next/link'
import { generateLeadScriptAction, markLeadIncomingMessageHandledAction, queueLeadManualMessageAction, recordLeadIncomingMessageAction, requestLeadCallbackAction, updateLeadPersonalInfoAction } from '@/app/dashboard/leads/actions'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import type { LeadAssignableProfile } from '@/lib/lead-access'
import type { ActivityRow, CallLogRow, ContractRow, DealFlowSummary, DealRow, LeadCommunicationRow, LeadRow, PaymentRow, SalesScriptRow, TaskRow } from '@/lib/queries'

export function LeadWorkspaceDrawer({
  lead,
  scripts,
  aiScript,
  deal,
  dealFlow,
  contracts = [],
  payments = [],
  tasks = [],
  communications = [],
  callLogs = [],
  scriptsMode = false,
  returnPath = '/dashboard/leads',
}: {
  lead: LeadRow
  scripts: SalesScriptRow[]
  aiScript?: ActivityRow | null
  deal?: DealRow | null
  dealFlow?: DealFlowSummary | null
  contracts?: ContractRow[]
  payments?: PaymentRow[]
  tasks?: TaskRow[]
  communications?: LeadCommunicationRow[]
  callLogs?: CallLogRow[]
  assignableProfiles: LeadAssignableProfile[]
  scriptsMode?: boolean
  returnPath?: string
}) {
  const paidAmount = dealFlow?.payment_paid_amount ?? 0
  const totalAmount = dealFlow?.payment_amount ?? 0
  const paymentProgress = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0
  const openInboundCount = communications.filter((message) => message.direction === 'inbound' && message.status !== 'handled').length
  const outboundWaitingCount = communications.filter((message) => message.direction === 'outbound' && ['queued', 'processing', 'sent'].includes(message.status || '')).length
  const latestCommunication = communications[0] ?? null
  const missedCallCount = callLogs.filter((call) => call.status === 'missed').length
  const latestCall = callLogs[0] ?? null

  return (
    <aside className="card stack deal-editor-drawer lead-scripts-drawer" id="lead-editor">
      <div className="compact-toolbar">
        <div>
          <div className="micro">ИИ-скрипт</div>
          <h2 style={{ margin: 0 }}>{lead.contact_name_raw || 'Без имени'}</h2>
          <div className="micro">Обновляется с учётом задач, пометок, комментариев и истории действий.</div>
        </div>
        <Link className="button-secondary" href={`${returnPath}?open=${encodeURIComponent(lead.id)}`}>Закрыть</Link>
      </div>

      <form action={generateLeadScriptAction} className="form-actions">
        <input type="hidden" name="lead_id" value={lead.id} />
        <button className="button">Обновить ИИ-скрипт</button>
      </form>

      <div id="lead-ai-script" className="notice lead-script-card lead-ai-script-card">
        <div style={{ fontWeight: 800 }}>{aiScript ? 'Актуальный скрипт' : 'Скрипт ещё не создан'}</div>
        <div className="micro">{aiScript ? `обновлён ${formatDateTime(aiScript.created_at)}` : 'нажмите «Обновить ИИ-скрипт»'}</div>
        <div>{aiScript?.body || 'ИИ подготовит персональный сценарий на основе карточки клиента, задач, комментариев и истории действий.'}</div>
      </div>

      <div className="lead-inline-form lead-client-summary">
        <div>
          <h3 style={{ margin: 0 }}>Карточка клиента</h3>
          <div className="micro">Связанные сделка, договор, оплата и ближайшие дела.</div>
        </div>
        <div className="lead-client-summary-grid">
          <div className="lead-client-summary-item">
            <div className="micro">Сделка</div>
            {deal ? (
              <Link href={`/dashboard/deals?open=${deal.id}#deal-editor`}>{deal.title}</Link>
            ) : (
              <span>Пока нет</span>
            )}
            <strong>{deal ? label('dealStage', deal.stage) : '—'}</strong>
          </div>
          <div className="lead-client-summary-item">
            <div className="micro">Договор</div>
            {dealFlow?.contract_id ? (
              <Link href={`/dashboard/contracts/${dealFlow.contract_id}`}>{label('contractStatus', dealFlow.contract_status || 'draft')}</Link>
            ) : (
              <span>Не создан</span>
            )}
            <strong>{dealFlow?.contract_signed_at ? `подписан ${formatDateTime(dealFlow.contract_signed_at)}` : 'ожидает'}</strong>
          </div>
          <div className="lead-client-summary-item">
            <div className="micro">Оплата</div>
            <span>{formatCurrency(paidAmount, deal?.currency || 'RUB')} / {formatCurrency(totalAmount, deal?.currency || 'RUB')}</span>
            <strong>{paymentProgress}%</strong>
          </div>
          <div className="lead-client-summary-item">
            <div className="micro">Ближайшие дела</div>
            <span>{tasks.length ? tasks[0]?.title : 'Нет открытых задач'}</span>
            <strong>{tasks[0]?.due_date ? formatDateTime(tasks[0].due_date) : '—'}</strong>
          </div>
        </div>
        <div className="lead-client-mini-list">
          {contracts.slice(0, 2).map((contract) => (
            <Link key={contract.id} href={`/dashboard/contracts/${contract.id}`} className="lead-client-mini-row">
              <span>{contract.title || contract.contract_number}</span>
              <small>{label('contractStatus', contract.status)} · {formatDateTime(contract.created_at)}</small>
            </Link>
          ))}
          {payments.slice(0, 2).map((payment) => (
            <div key={payment.id} className="lead-client-mini-row">
              <span>{payment.label}</span>
              <small>{label('paymentStatus', payment.status)} · {formatCurrency(payment.paid_amount ?? 0, payment.currency)} / {formatCurrency(payment.amount, payment.currency)}</small>
            </div>
          ))}
        </div>
      </div>

      <div id="lead-personal-info" className="lead-inline-form lead-personal-info-form">
        <div>
          <h3 style={{ margin: 0 }}>Личная информация</h3>
          <div className="micro">Эти данные используются ИИ при обновлении скрипта.</div>
        </div>
        <form action={updateLeadPersonalInfoAction} className="compact-form-grid compact-form-grid--lead-personal">
          <input type="hidden" name="lead_id" value={lead.id} />
          <label>Имя<input name="contact_name_raw" defaultValue={lead.contact_name_raw || ''} placeholder="Анна Иванова" /></label>
          <label>Телефон<input name="phone_raw" defaultValue={lead.phone_raw || ''} placeholder="+7..." /></label>
          <label>Email<input name="email_raw" type="email" defaultValue={lead.email_raw || ''} placeholder="client@example.com" /></label>
          <label>Интерес / страна<input name="desired_country" defaultValue={lead.desired_country || ''} placeholder="Великобритания, языковой лагерь" /></label>
          <label className="lead-personal-wide">Источник / контекст<input name="source_detail" defaultValue={lead.source_detail || ''} placeholder="Откуда пришёл клиент и что уже известно" /></label>
          <label className="lead-personal-wide">Личные заметки<textarea name="message" defaultValue={lead.message || ''} placeholder="Возраст, цели, бюджет, страхи, предпочтения, кто принимает решение" /></label>
          <div className="form-actions"><button className="button-secondary">Сохранить информацию</button></div>
        </form>
      </div>

      <div id="lead-communications" className="lead-inline-form lead-communications-form">
        <div className="lead-communications-head">
          <div>
            <h3 style={{ margin: 0 }}>Связь с клиентом</h3>
            <div className="micro">Единая лента входящих и исходящих сообщений по клиенту.</div>
          </div>
          <div className="compact-badges">
            <span className={`badge ${openInboundCount ? 'danger' : 'success'}`}>Ответить: {openInboundCount}</span>
            <span className="badge">Ожидаем: {outboundWaitingCount}</span>
            <span className={`badge ${missedCallCount ? 'danger' : ''}`}>Звонки: {callLogs.length}</span>
          </div>
        </div>
        <div className="lead-call-panel">
          <div>
            <strong>IP-телефония Exolve</strong>
            <div className="micro">
              {latestCall ? `Последний звонок: ${formatDateTime(latestCall.created_at)} · ${latestCall.status}` : 'Звонков по клиенту пока нет.'}
            </div>
          </div>
          <form action={requestLeadCallbackAction} className="lead-call-form">
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="client_phone" value={lead.phone_raw || ''} />
            <button className="button" disabled={!lead.phone_raw}>Позвонить</button>
          </form>
        </div>
        {latestCommunication ? (
          <div className="lead-communication-summary">
            <span>{latestCommunication.direction === 'inbound' ? 'Последнее входящее' : 'Последнее исходящее'}</span>
            <strong>{formatDateTime(latestCommunication.occurred_at)}</strong>
          </div>
        ) : null}
        {communications.length ? (
          <div className="lead-communication-timeline">
            {communications.map((message) => (
              <div key={`${message.direction}-${message.id}`} className={`lead-communication-item lead-communication-item--${message.direction}`}>
                <div className="lead-communication-item__head">
                  <span className="badge">{message.direction === 'inbound' ? 'Входящее' : 'Исходящее'}</span>
                  <span className="micro">
                    {message.channel}
                    {message.direction === 'outbound' && message.status ? ` · ${label('outboxStatus', message.status)}` : ''}
                    {message.direction === 'inbound' && message.status === 'handled' ? ' · отработано' : ''}
                    {message.direction === 'inbound' && message.status !== 'handled' ? ' · требует ответа' : ''}
                  </span>
                  <span className="micro">{formatDateTime(message.occurred_at)}</span>
                </div>
                <div className="lead-communication-item__contact">
                  {message.contact_name || message.contact_email || message.contact_phone || 'Контакт не указан'}
                </div>
                {message.subject ? <strong>{message.subject}</strong> : null}
                <div className="lead-communication-item__body">{message.body}</div>
                {message.direction === 'inbound' && message.status !== 'handled' ? (
                  <form action={markLeadIncomingMessageHandledAction} className="form-actions">
                    <input type="hidden" name="lead_id" value={lead.id} />
                    <input type="hidden" name="message_id" value={message.id} />
                    <button className="button-secondary">Отработано</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="notice">Переписки пока нет. Отправьте сообщение или добавьте входящий ответ клиента.</div>
        )}

        {callLogs.length ? (
          <details className="lead-communication-compose" open={missedCallCount > 0}>
            <summary>История звонков</summary>
            <div className="lead-call-list">
              {callLogs.map((call) => (
                <div key={call.id} className={`lead-call-item lead-call-item--${call.status}`}>
                  <div>
                    <strong>{call.status === 'missed' ? 'Пропущенный звонок' : call.direction === 'callback' ? 'Callback Exolve' : 'Звонок'}</strong>
                    <div className="micro">{formatDateTime(call.started_at || call.created_at)} · {call.display_number ? `+${call.display_number}` : 'номер не определён'}</div>
                  </div>
                  <div className="compact-badges">
                    <span className={`badge ${call.status === 'missed' || call.status === 'failed' ? 'danger' : call.status === 'completed' || call.status === 'answered' ? 'success' : ''}`}>{call.status}</span>
                    {call.duration_seconds ? <span className="badge">{call.duration_seconds} сек.</span> : null}
                    {call.recording_url ? <a className="button-secondary" href={call.recording_url} target="_blank" rel="noreferrer">Запись</a> : null}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <details className="lead-communication-compose">
          <summary>Написать клиенту</summary>
        <form action={queueLeadManualMessageAction} className="compact-form-grid compact-form-grid--lead-message">
          <input type="hidden" name="lead_id" value={lead.id} />
          <label>Получатель<input name="recipient_name" defaultValue={lead.contact_name_raw || ''} placeholder="Имя клиента" /></label>
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
          <label>Email<input name="recipient_email" type="email" defaultValue={lead.email_raw || ''} placeholder="client@example.com" /></label>
          <label>Телефон<input name="recipient_phone" defaultValue={lead.phone_raw || ''} placeholder="+7..." /></label>
          <label>Отправить после<input name="send_after" type="datetime-local" /></label>
          <label className="lead-personal-wide">Тема<input name="subject" placeholder="Следующий шаг по поездке" /></label>
          <label className="lead-personal-wide">Текст<textarea name="body" placeholder="Текст сообщения клиенту" required /></label>
          <div className="form-actions"><button className="button-secondary">Поставить в очередь</button></div>
        </form>
        </details>

        <details className="lead-communication-compose">
          <summary>Добавить входящий ответ</summary>
          <form action={recordLeadIncomingMessageAction} className="compact-form-grid compact-form-grid--lead-message">
            <input type="hidden" name="lead_id" value={lead.id} />
            <label>Отправитель<input name="sender_name" defaultValue={lead.contact_name_raw || ''} placeholder="Имя клиента" /></label>
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
            <label>Email<input name="sender_email" type="email" defaultValue={lead.email_raw || ''} placeholder="client@example.com" /></label>
            <label>Телефон<input name="sender_phone" defaultValue={lead.phone_raw || ''} placeholder="+7..." /></label>
            <label>Получено<input name="received_at" type="datetime-local" /></label>
            <label className="lead-personal-wide">Тема<input name="subject" placeholder="Ответ по договору" /></label>
            <label className="lead-personal-wide">Текст<textarea name="body" placeholder="Что написал или сказал клиент" required /></label>
            <div className="form-actions"><button className="button-secondary">Добавить в историю связи</button></div>
          </form>
        </details>
      </div>

      {scriptsMode && scripts.length ? (
        <div className="stack">
          <h3 style={{ margin: 0 }}>Базовые скрипты сегмента</h3>
          {scripts.map((script) => (
            <div key={script.id} className="notice lead-script-card">
              <div style={{ fontWeight: 800 }}>{script.title}</div>
              <div className="micro">{script.stage}</div>
              <div>{script.body}</div>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
