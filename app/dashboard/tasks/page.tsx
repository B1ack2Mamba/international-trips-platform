import Link from 'next/link'
import { createGeneralTaskAction, updateTaskStatusAction } from './actions'
import { requireDashboardAccess } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { getTasksForOwner, type TaskRow } from '@/lib/queries'

export const dynamic = 'force-dynamic'

function taskHref(task: TaskRow) {
  if (task.deal_id) return `/dashboard/deals?open=${task.deal_id}#deal-editor`
  if (task.lead_id) return `/dashboard/my-leads?open=${task.lead_id}`
  if (task.application_id) return `/dashboard/applications/${task.application_id}`
  return '/dashboard/tasks'
}

function taskContext(task: TaskRow) {
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

function taskBucket(task: TaskRow) {
  const tone = dueTone(task.due_date)
  if (tone === 'danger') return 'overdue'
  if (tone === 'warning') return 'today'
  if (task.due_date) return 'upcoming'
  return 'without_date'
}

function TaskStatusForm({ task, status, labelText }: { task: TaskRow; status: string; labelText: string }) {
  return (
    <form action={updateTaskStatusAction}>
      <input type="hidden" name="task_id" value={task.id} />
      <input type="hidden" name="status" value={status} />
      <button className="button-secondary">{labelText}</button>
    </form>
  )
}

function TaskTable({ title, tasks }: { title: string; tasks: TaskRow[] }) {
  if (!tasks.length) return null

  return (
    <section className="stack">
      <div className="section-mini-head">
        <h3>{title}</h3>
        <span className="badge">{tasks.length}</span>
      </div>
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
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <strong>{task.title}</strong>
                  {task.description ? <div className="micro">{task.description}</div> : null}
                </td>
                <td><Link href={taskHref(task)}>{taskContext(task)}</Link></td>
                <td>{label('priority', task.priority)}</td>
                <td><span className={`badge ${dueTone(task.due_date)}`}>{formatDateTime(task.due_date)}</span></td>
                <td>
                  <div className="form-actions task-actions">
                    <Link className="button-secondary" href={taskHref(task)}>Открыть</Link>
                    {task.status !== 'doing' ? <TaskStatusForm task={task} status="doing" labelText="В работу" /> : null}
                    <TaskStatusForm task={task} status="done" labelText="Готово" />
                    <TaskStatusForm task={task} status="cancelled" labelText="Отменить" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
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
  const status = typeof params.status === 'string' ? params.status : ''

  const tasks = await getTasksForOwner(user!.id, 160)
  const filtered = tasks.filter((task) => {
    return (!priority || task.priority === priority)
      && (!scope || (scope === 'lead' ? Boolean(task.lead_id) : scope === 'deal' ? Boolean(task.deal_id) : scope === 'application' ? Boolean(task.application_id) : true))
      && (!status || task.status === status)
  })
  const overdue = filtered.filter((task) => dueTone(task.due_date) === 'danger').length
  const today = filtered.filter((task) => dueTone(task.due_date) === 'warning').length
  const grouped = {
    overdue: filtered.filter((task) => taskBucket(task) === 'overdue'),
    today: filtered.filter((task) => taskBucket(task) === 'today'),
    upcoming: filtered.filter((task) => taskBucket(task) === 'upcoming'),
    without_date: filtered.filter((task) => taskBucket(task) === 'without_date'),
  }

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
        <div className="section-mini-head">
          <h2>Новая задача</h2>
          <span className="badge">Личная</span>
        </div>
        <form action={createGeneralTaskAction} className="compact-form-grid compact-form-grid--task-create">
          <label>Название<input name="title" placeholder="Позвонить клиенту / проверить оплату" required /></label>
          <label>Приоритет
            <select name="priority" defaultValue="medium">
              <option value="critical">Критический</option>
              <option value="high">Высокий</option>
              <option value="medium">Средний</option>
              <option value="low">Низкий</option>
            </select>
          </label>
          <label>Срок<input name="due_date" type="datetime-local" /></label>
          <label className="task-description-field">Описание<textarea name="description" placeholder="Контекст, что нужно сделать и какой следующий шаг" /></label>
          <div className="form-actions"><button className="button">Создать задачу</button></div>
        </form>
      </article>

      <article className="card stack">
        <form className="compact-form-grid compact-form-grid--tasks-filters" action="/dashboard/tasks">
          <label>
            Статус
            <select name="status" defaultValue={status}>
              <option value="">Открытые</option>
              <option value="todo">К исполнению</option>
              <option value="doing">В работе</option>
            </select>
          </label>
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

        <TaskTable title="Просрочено" tasks={grouped.overdue} />
        <TaskTable title="Сегодня" tasks={grouped.today} />
        <TaskTable title="Будущие касания" tasks={grouped.upcoming} />
        <TaskTable title="Без срока" tasks={grouped.without_date} />
        {!filtered.length ? <div className="notice">Открытых дел нет. Новые задачи появляются из клиентов и сделок.</div> : null}
      </article>
    </div>
  )
}
