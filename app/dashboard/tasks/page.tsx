import Link from 'next/link'
import { updateTaskStatusAction } from './actions'
import { requireDashboardAccess } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { getTasksForOwner } from '@/lib/queries'

export const dynamic = 'force-dynamic'

function taskHref(task: Awaited<ReturnType<typeof getTasksForOwner>>[number]) {
  if (task.deal_id) return `/dashboard/deals?open=${task.deal_id}#deal-editor`
  if (task.lead_id) return `/dashboard/my-leads?open=${task.lead_id}`
  if (task.application_id) return `/dashboard/applications/${task.application_id}`
  return '/dashboard/tasks'
}

function taskContext(task: Awaited<ReturnType<typeof getTasksForOwner>>[number]) {
  if (task.deal) return `Сделка: ${task.deal.title}`
  if (task.lead) return `Клиент: ${task.lead.contact_name_raw || task.lead.phone_raw || task.lead.email_raw || 'без имени'}`
  if (task.application) return `Участник: ${task.application.participant_name || 'без имени'}`
  return 'Общая задача'
}

function dueTone(value: string | null) {
  if (!value) return ''
  const due = new Date(value).getTime()
  if (Number.isNaN(due)) return ''
  if (due < Date.now()) return 'danger'
  if (due < Date.now() + 24 * 60 * 60 * 1000) return 'warning'
  return 'success'
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { user } = await requireDashboardAccess('/dashboard/tasks')
  const params = (await searchParams) ?? {}
  const priority = typeof params.priority === 'string' ? params.priority : ''
  const scope = typeof params.scope === 'string' ? params.scope : ''

  const tasks = await getTasksForOwner(user!.id, 160)
  const filtered = tasks.filter((task) => {
    return (!priority || task.priority === priority)
      && (!scope || (scope === 'lead' ? Boolean(task.lead_id) : scope === 'deal' ? Boolean(task.deal_id) : scope === 'application' ? Boolean(task.application_id) : true))
  })
  const overdue = filtered.filter((task) => dueTone(task.due_date) === 'danger').length
  const today = filtered.filter((task) => dueTone(task.due_date) === 'warning').length

  return (
    <div className="content-stack compact-page fullscreen-stretch tasks-page">
      <section className="section-head leads-section-head leads-section-head--tight">
        <div>
          <h1 className="page-title">Мои дела</h1>
          <p className="muted">Единый рабочий список задач по клиентам, сделкам и участникам. Это ежедневный центр менеджера.</p>
        </div>
        <div className="compact-badges">
          <span className="badge">Открыто: {filtered.length}</span>
          <span className={`badge ${overdue ? 'danger' : ''}`}>Просрочено: {overdue}</span>
          <span className={`badge ${today ? 'success' : ''}`}>Сегодня: {today}</span>
        </div>
      </section>

      <article className="card stack">
        <form className="compact-form-grid compact-form-grid--tasks-filters" action="/dashboard/tasks">
          <label>
            Приоритет
            <select name="priority" defaultValue={priority}>
              <option value="">Все</option>
              <option value="critical">Критический</option>
              <option value="high">Высокий</option>
              <option value="medium">Средний</option>
              <option value="low">Низкий</option>
            </select>
          </label>
          <label>
            Контекст
            <select name="scope" defaultValue={scope}>
              <option value="">Все</option>
              <option value="lead">Клиенты</option>
              <option value="deal">Сделки</option>
              <option value="application">Участники</option>
            </select>
          </label>
          <div className="form-actions">
            <button className="button-secondary">Фильтровать</button>
            <Link className="button-secondary" href="/dashboard/tasks">Сбросить</Link>
          </div>
        </form>

        <div className="table-wrap">
          <table className="table compact-table">
            <thead>
              <tr>
                <th>Дело</th>
                <th>Контекст</th>
                <th>Приоритет</th>
                <th>Срок</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <tr key={task.id}>
                  <td>
                    <strong>{task.title}</strong>
                    {task.description ? <div className="micro">{task.description}</div> : null}
                  </td>
                  <td><Link href={taskHref(task)}>{taskContext(task)}</Link></td>
                  <td>{label('priority', task.priority)}</td>
                  <td><span className={`badge ${dueTone(task.due_date)}`}>{formatDateTime(task.due_date)}</span></td>
                  <td>
                    <div className="form-actions">
                      <Link className="button-secondary" href={taskHref(task)}>Открыть</Link>
                      <form action={updateTaskStatusAction}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="status" value="done" />
                        <button className="button-secondary">Готово</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length ? <div className="notice">Открытых дел нет. Новые задачи появляются из клиентов и сделок.</div> : null}
      </article>
    </div>
  )
}

