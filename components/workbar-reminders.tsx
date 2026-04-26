import Link from 'next/link'

import { completeTaskFromWorkbarAction } from '@/app/dashboard/tasks/actions'
import { formatDateTime } from '@/lib/format'
import { getWorkbarAttentionSummary, type TaskRow, type WorkbarAttentionCall, type WorkbarAttentionContract, type WorkbarAttentionMessage } from '@/lib/queries'

function taskHref(task: TaskRow) {
  if (task.lead_id) return `/dashboard/my-leads?open=${task.lead_id}`
  if (task.deal_id) return `/dashboard/deals?open=${task.deal_id}#deal-editor`
  if (task.application_id) return `/dashboard/participants/${task.application_id}`
  return '/dashboard/tasks'
}

function taskContext(task: TaskRow) {
  if (task.lead) return task.lead.contact_name_raw || task.lead.phone_raw || task.lead.email_raw || 'Лид'
  if (task.deal) return task.deal.title || 'Сделка'
  if (task.application) return task.application.participant_name || 'Участник'
  return 'CRM'
}

function reminderTone(summary: Awaited<ReturnType<typeof getWorkbarAttentionSummary>>) {
  if (summary.task_summary.overdue > 0 || summary.missed_calls > 0) return 'is-danger'
  if (summary.task_summary.due_today > 0 || summary.inbox_open > 0 || summary.pending_contracts > 0) return 'is-warning'
  return 'is-calm'
}

function dueTime(task: TaskRow) {
  if (!task.due_date) return Number.POSITIVE_INFINITY
  const value = new Date(task.due_date).getTime()
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value
}

function dueCountdown(task: TaskRow) {
  const due = dueTime(task)
  if (!Number.isFinite(due)) return 'без срока'

  const diff = due - Date.now()
  const abs = Math.abs(diff)
  const minutes = Math.max(1, Math.round(abs / 60000))
  const hours = Math.round(abs / 3600000)
  const days = Math.round(abs / 86400000)
  const value = days >= 1 ? `${days} дн.` : hours >= 1 ? `${hours} ч.` : `${minutes} мин.`
  return diff < 0 ? `просрочено ${value}` : `через ${value}`
}

export async function WorkbarReminders({ profileId }: { profileId: string }) {
  const summary = await getWorkbarAttentionSummary(profileId, 4)
  const tone = reminderTone(summary)
  const sortedItems = [...summary.task_summary.items].sort((a, b) => dueTime(a) - dueTime(b))

  const messageHref = (message: WorkbarAttentionMessage) =>
    message.lead_id ? `/dashboard/my-leads?open=${message.lead_id}#lead-communications` : '/dashboard/communications'

  const callHref = (call: WorkbarAttentionCall) =>
    call.lead_id ? `/dashboard/my-leads?open=${call.lead_id}#lead-communications` : '/dashboard/communications'

  const contractHref = (contract: WorkbarAttentionContract) =>
    contract.id ? `/dashboard/contracts/${contract.id}` : '/dashboard/contracts'

  return (
    <div className="workbar-reminders" aria-label="Напоминания CRM">
      <details className={`workbar-notifications ${tone}`}>
        <summary className="workbar-notifications-trigger">
          <span className="workbar-notifications-title">Фокус CRM</span>
          <span className="workbar-notifications-count">{summary.total_attention}</span>
        </summary>
        <div className="workbar-notifications-panel">
          <div className="workbar-notifications-head">
            <div>
              <strong>Что требует внимания</strong>
              <div className="micro">Просрочено: {summary.task_summary.overdue} · Ответить: {summary.inbox_open} · Пропущено: {summary.missed_calls}</div>
            </div>
            <Link className="button-secondary" href="/dashboard/tasks">Все дела</Link>
          </div>
          {sortedItems.length > 0 ? (
            <div className="workbar-notification-group">
              <div className="workbar-group-label">Задачи</div>
              <div className="workbar-notification-list">
              {sortedItems.map((task) => (
                <div key={task.id} className="workbar-notification-item">
                  <Link className="workbar-notification-link" href={taskHref(task)}>
                    <span>{task.title}</span>
                    <small>
                      {taskContext(task)} · {formatDateTime(task.due_date)}
                    </small>
                  </Link>
                  <div className="workbar-notification-actions">
                    <span className={`workbar-task-timer ${dueTime(task) < Date.now() ? 'is-overdue' : ''}`}>{dueCountdown(task)}</span>
                    <form action={completeTaskFromWorkbarAction}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <button className="button-secondary">Готово</button>
                    </form>
                  </div>
                </div>
              ))}
              </div>
            </div>
          ) : null}
          {summary.inbox_items.length > 0 ? (
            <div className="workbar-notification-group">
              <div className="workbar-group-label">Нужно ответить</div>
              <div className="workbar-notification-list">
                {summary.inbox_items.map((message) => (
                  <div key={message.id} className="workbar-notification-item">
                    <Link className="workbar-notification-link" href={messageHref(message)}>
                      <span>{message.sender_name || message.lead?.contact_name_raw || 'Клиент'}</span>
                      <small>{message.subject || message.sender_phone || message.sender_email || 'Открыть переписку'} · {formatDateTime(message.received_at)}</small>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {summary.missed_call_items.length > 0 ? (
            <div className="workbar-notification-group">
              <div className="workbar-group-label">Пропущенные звонки</div>
              <div className="workbar-notification-list">
                {summary.missed_call_items.map((call) => (
                  <div key={call.id} className="workbar-notification-item">
                    <Link className="workbar-notification-link" href={callHref(call)}>
                      <span>{call.lead?.contact_name_raw || 'Звонок'}</span>
                      <small>{call.display_number ? `+${call.display_number}` : 'номер не определён'} · {formatDateTime(call.started_at || call.created_at)}</small>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {summary.pending_contract_items.length > 0 ? (
            <div className="workbar-notification-group">
              <div className="workbar-group-label">Договоры ждут подписи</div>
              <div className="workbar-notification-list">
                {summary.pending_contract_items.map((contract) => (
                  <div key={contract.id} className="workbar-notification-item">
                    <Link className="workbar-notification-link" href={contractHref(contract)}>
                      <span>{contract.application?.participant_name || contract.title}</span>
                      <small>{contract.deal?.title || contract.title} · {formatDateTime(contract.created_at)}</small>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {!sortedItems.length && !summary.inbox_items.length && !summary.missed_call_items.length && !summary.pending_contract_items.length ? (
            <div className="workbar-notification-empty">Срочных сигналов нет.</div>
          ) : null}
        </div>
      </details>
      <div className="workbar-reminder-meta">
        <Link className={`workbar-reminder-chip ${tone}`} href="/dashboard/tasks">
          <span>Просрочено</span>
          <strong>{summary.task_summary.overdue}</strong>
        </Link>
        <Link className={`workbar-reminder-chip ${summary.inbox_open ? 'is-warning' : 'is-calm'}`} href="/dashboard/communications">
          <span>Ответы</span>
          <strong>{summary.inbox_open}</strong>
        </Link>
        <Link className={`workbar-reminder-chip ${summary.missed_calls ? 'is-danger' : 'is-calm'}`} href="/dashboard/communications">
          <span>Звонки</span>
          <strong>{summary.missed_calls}</strong>
        </Link>
      </div>
    </div>
  )
}
