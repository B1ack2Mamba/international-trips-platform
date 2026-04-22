import Link from 'next/link'

import { updateTaskStatusAction } from '@/app/dashboard/tasks/actions'
import { formatDateTime } from '@/lib/format'
import { getTaskReminderSummary, type TaskRow } from '@/lib/queries'

function taskHref(task: TaskRow) {
  if (task.lead_id) return `/dashboard/my-leads?open=${task.lead_id}`
  if (task.deal_id) return `/dashboard/deals?deal=${task.deal_id}`
  if (task.application_id) return `/dashboard/applications?application=${task.application_id}`
  return '/dashboard/tasks'
}

function taskContext(task: TaskRow) {
  if (task.lead) return task.lead.contact_name_raw || task.lead.phone_raw || task.lead.email_raw || 'Лид'
  if (task.deal) return task.deal.title || 'Сделка'
  if (task.application) return task.application.participant_name || 'Участник'
  return 'CRM'
}

function reminderTone(summary: Awaited<ReturnType<typeof getTaskReminderSummary>>) {
  if (summary.overdue > 0) return 'is-danger'
  if (summary.due_today > 0) return 'is-warning'
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
  const summary = await getTaskReminderSummary(profileId, 8)
  const tone = reminderTone(summary)
  const sortedItems = [...summary.items].sort((a, b) => dueTime(a) - dueTime(b))

  return (
    <div className="workbar-reminders" aria-label="Напоминания CRM">
      <details className={`workbar-notifications ${tone}`}>
        <summary className="workbar-notifications-trigger">
          <span className="workbar-notifications-title">Мои дела</span>
          <span className="workbar-notifications-count">{summary.total_open}</span>
        </summary>
        <div className="workbar-notifications-panel">
          <div className="workbar-notifications-head">
            <div>
              <strong>Новые и активные задачи</strong>
              <div className="micro">Просрочено: {summary.overdue} · Сегодня: {summary.due_today}</div>
            </div>
            <Link className="button-secondary" href="/dashboard/tasks">Все дела</Link>
          </div>
          {sortedItems.length > 0 ? (
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
                    <form action={updateTaskStatusAction}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="status" value="done" />
                      <input type="hidden" name="return_path" value="/dashboard" />
                      <button className="button-secondary">Готово</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="workbar-notification-empty">Новых задач нет.</div>
          )}
        </div>
      </details>
      <div className="workbar-reminder-meta">
        <Link className={`workbar-reminder-chip ${tone}`} href="/dashboard/tasks">
          <span>Просрочено</span>
          <strong>{summary.overdue}</strong>
        </Link>
        <Link className="workbar-reminder-chip is-today" href="/dashboard/tasks">
          <span>Сегодня</span>
          <strong>{summary.due_today}</strong>
        </Link>
      </div>
    </div>
  )
}
