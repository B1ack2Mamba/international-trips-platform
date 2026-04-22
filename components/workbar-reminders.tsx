import Link from 'next/link'

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

export async function WorkbarReminders({ profileId }: { profileId: string }) {
  const summary = await getTaskReminderSummary(profileId, 8)
  const tone = reminderTone(summary)

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
          {summary.items.length > 0 ? (
            <div className="workbar-notification-list">
              {summary.items.map((task) => (
                <Link key={task.id} className="workbar-notification-item" href={taskHref(task)}>
                  <span>{task.title}</span>
                  <small>
                    {taskContext(task)} · {formatDateTime(task.due_date)}
                  </small>
                </Link>
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
