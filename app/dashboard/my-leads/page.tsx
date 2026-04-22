import Link from 'next/link'
import { completeLeadTaskAction, convertLeadToDeal, createLeadNoteAction, createLeadTaskAction, generateLeadScriptAction, transferLeadOwner, updateLeadStatus } from '@/app/dashboard/leads/actions'
import { createGeneralTaskAction, updateTaskStatusAction } from '@/app/dashboard/tasks/actions'
import { LeadRegistryTable } from '@/components/lead-registry-table'
import { LeadWorkspaceDrawer } from '@/components/lead-workspace-drawer'
import { getLeadAssignableProfiles, type LeadAssignableProfile } from '@/lib/lead-access'
import { requireDashboardAccess } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { getActivityLog, getLeadById, getMyLeads, getSalesScriptsBySegment, getTasksByLead, getTasksForOwner, type LeadRow, type TaskRow } from '@/lib/queries'

export const dynamic = 'force-dynamic'

function MyLeadActionPanel({
  lead,
  assignableProfiles,
  mode,
  activities,
  tasks,
}: {
  lead: LeadRow
  assignableProfiles: LeadAssignableProfile[]
  mode: 'default' | 'deal' | 'transfer'
  activities: Awaited<ReturnType<typeof getActivityLog>>
  tasks: TaskRow[]
}) {
  const baseHref = `/dashboard/my-leads?open=${encodeURIComponent(lead.id)}`
  const transferTargets = assignableProfiles.filter((profile) => profile.id !== lead.owner_user_id)
  const titleDefault = `${lead.desired_program?.title || lead.desired_country || 'Программа'} / ${lead.contact_name_raw || 'Контакт'}`
  const canAct = lead.owner_user_id && lead.status !== 'archived' && !lead.converted_deal_id

  return (
    <div className="lead-action-popover">
      <div className="lead-action-popover__head">
        <div>
          <div className="micro">Работа с клиентом</div>
          <h3>{lead.contact_name_raw || 'Без имени'}</h3>
        </div>
        <div className="lead-action-pills">
          {lead.converted_deal_id ? <span className="badge success">Сделка создана</span> : null}
          {!lead.converted_deal_id ? <span className="badge success">Передать или оформить сделку</span> : null}
        </div>
      </div>

      <div className="lead-action-bar">
        {lead.converted_deal_id ? (
          <Link className="button" href={`/dashboard/deals?open=${lead.converted_deal_id}#deal-editor`}>Открыть сделку</Link>
        ) : null}
        {canAct ? <Link className="button" href={`${baseHref}&deal=1#lead-action-panel`}>Оформить сделку</Link> : null}
        {canAct ? <Link className="button-secondary" href={`${baseHref}&transfer=1#lead-action-panel`}>Передать</Link> : null}
        {canAct ? (
          <form action={updateLeadStatus}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="status" value="archived" />
            <button className="button-secondary">В архив</button>
          </form>
        ) : null}
        <Link className="button-secondary" href={`${baseHref}&scripts=1#lead-editor`}>Базовые скрипты</Link>
        <form action={generateLeadScriptAction}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <button className="button-secondary">Обновить ИИ-скрипт</button>
        </form>
      </div>

      <div className="lead-inline-form">
        <div className="lead-action-popover__head">
          <div>
            <h3>Комментарий в ленту</h3>
            <div className="micro">Фиксируйте звонки, договорённости, возражения и важный контекст.</div>
          </div>
        </div>
        <form action={createLeadNoteAction} className="compact-form-grid compact-form-grid--lead-note">
          <input type="hidden" name="lead_id" value={lead.id} />
          <label>Тип заметки<input name="title" placeholder="Звонок / WhatsApp / договорённость" defaultValue="Комментарий менеджера" /></label>
          <label className="lead-note-field">Комментарий<textarea name="note" placeholder="Что произошло и что важно помнить" required /></label>
          <div className="form-actions"><button className="button-secondary">Добавить в ленту</button></div>
        </form>
      </div>

      <div className="lead-inline-form">
        <div className="lead-action-popover__head">
          <div>
            <h3>Следующее касание</h3>
            <div className="micro">Задача закрепится за этим клиентом и будет видна в CRM.</div>
          </div>
        </div>
        <form action={createLeadTaskAction} className="compact-form-grid compact-form-grid--lead-task">
          <input type="hidden" name="lead_id" value={lead.id} />
          <label>Что сделать<input name="title" placeholder="Позвонить и согласовать договор" required /></label>
          <label>Когда<input name="due_date" type="datetime-local" /></label>
          <label>
            Приоритет
            <select name="priority" defaultValue="medium">
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
              <option value="critical">Критический</option>
            </select>
          </label>
          <div className="form-actions"><button className="button-secondary">Поставить задачу</button></div>
        </form>
        {tasks.length ? (
          <div className="lead-task-list">
            {tasks.map((task) => (
              <form key={task.id} action={completeLeadTaskAction} className="lead-task-item">
                <input type="hidden" name="lead_id" value={lead.id} />
                <input type="hidden" name="task_id" value={task.id} />
                <input type="hidden" name="title" value={task.title} />
                <div>
                  <strong>{task.title}</strong>
                  <div className="micro">{task.due_date ? formatDateTime(task.due_date) : 'Без срока'} · {label('priority', task.priority)}</div>
                </div>
                <button className="button-secondary">Готово</button>
              </form>
            ))}
          </div>
        ) : null}
      </div>

      {mode === 'transfer' && canAct ? (
        <form id="lead-action-panel" className="lead-inline-form" action={transferLeadOwner}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <label>
            Новый менеджер
            <select name="owner_user_id" required defaultValue="">
              <option value="" disabled>Выберите пользователя</option>
              {transferTargets.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name || profile.email || profile.id}
                </option>
              ))}
            </select>
          </label>
          <label>Комментарий к передаче<textarea name="note" placeholder="Что важно знать новому менеджеру" required /></label>
          <div className="form-actions"><button className="button">Передать клиента</button></div>
        </form>
      ) : null}

      {mode === 'deal' && canAct ? (
        <form id="lead-action-panel" className="lead-inline-form lead-inline-form--deal" action={convertLeadToDeal}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <input type="hidden" name="stage" value="qualified" />
          <div className="form-grid">
            <label>Название сделки<input name="title" defaultValue={titleDefault} required /></label>
            <label>Оценка суммы<input name="estimated_value" type="number" min="0" step="1000" placeholder="180000" /></label>
            <label>Валюта<select name="currency" defaultValue="RUB"><option value="RUB">RUB</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="CNY">CNY</option></select></label>
            <label>Участников<input name="participants_count" type="number" min="1" defaultValue="1" /></label>
            <label>План закрытия<input name="close_date" type="date" /></label>
          </div>
          <label>Комментарий для сделки<textarea name="notes" defaultValue={lead.message || 'Сделка оформлена из лида.'} /></label>
          <label className="inline-checkbox"><input name="create_account" type="checkbox" defaultChecked /><span>Создать или привязать аккаунт семьи автоматически</span></label>
          <div className="form-actions"><button className="button">Создать сделку</button></div>
        </form>
      ) : null}

      <div id="lead-history" className="lead-inline-form">
        <h3 style={{ margin: 0 }}>История действий</h3>
        {activities.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Событие</th><th>Комментарий</th><th>Кто</th><th>Когда</th></tr></thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id}>
                    <td><div>{activity.title}</div><div className="micro">{activity.event_type}</div></td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{activity.body || '—'}</td>
                    <td>{activity.actor?.full_name || activity.actor?.email || 'система'}</td>
                    <td>{formatDateTime(activity.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="muted">История пока пустая.</div>}
      </div>
    </div>
  )
}

function taskHref(task: TaskRow) {
  if (task.deal_id) return `/dashboard/deals?open=${task.deal_id}#deal-editor`
  if (task.lead_id) return `/dashboard/my-leads?open=${task.lead_id}`
  if (task.application_id) return `/dashboard/applications/${task.application_id}`
  return '/dashboard/my-leads#my-tasks'
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

function MyTasksSection({ tasks }: { tasks: TaskRow[] }) {
  const overdue = tasks.filter((task) => dueTone(task.due_date) === 'danger').length
  const today = tasks.filter((task) => dueTone(task.due_date) === 'warning').length

  return (
    <article id="my-tasks" className="card stack">
      <div className="section-mini-head">
        <div>
          <h2>Мои дела</h2>
          <div className="micro">Задачи по клиентам, сделкам, участникам и личные напоминания теперь на одной странице с лидами.</div>
        </div>
        <div className="compact-badges">
          <span className="badge">Открыто: {tasks.length}</span>
          <span className={`badge ${overdue ? 'danger' : ''}`}>Просрочено: {overdue}</span>
          <span className={`badge ${today ? 'success' : ''}`}>Сегодня: {today}</span>
        </div>
      </div>

      <form action={createGeneralTaskAction} className="compact-form-grid compact-form-grid--task-create">
        <input type="hidden" name="return_path" value="/dashboard/my-leads#my-tasks" />
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

      <div className="table-wrap">
        <table className="table compact-table">
          <thead>
            <tr><th>Дело</th><th>Контекст</th><th>Приоритет</th><th>Срок</th><th>Действия</th></tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td><strong>{task.title}</strong>{task.description ? <div className="micro">{task.description}</div> : null}</td>
                <td><Link href={taskHref(task)}>{taskContext(task)}</Link></td>
                <td>{label('priority', task.priority)}</td>
                <td><span className={`badge ${dueTone(task.due_date)}`}>{formatDateTime(task.due_date)}</span></td>
                <td>
                  <div className="form-actions task-actions">
                    <Link className="button-secondary" href={taskHref(task)}>Открыть</Link>
                    <form action={updateTaskStatusAction}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="status" value="doing" />
                      <input type="hidden" name="return_path" value="/dashboard/my-leads#my-tasks" />
                      <button className="button-secondary">В работу</button>
                    </form>
                    <form action={updateTaskStatusAction}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="status" value="done" />
                      <input type="hidden" name="return_path" value="/dashboard/my-leads#my-tasks" />
                      <button className="button-secondary">Готово</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!tasks.length ? <div className="notice">Открытых дел нет.</div> : null}
    </article>
  )
}

export default async function MyLeadsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { user } = await requireDashboardAccess('/dashboard/my-leads')
  const params = (await searchParams) ?? {}
  const openLeadId = typeof params.open === 'string' ? params.open : ''
  const scriptsMode = params.scripts === '1'
  const dealMode = params.deal === '1'
  const transferMode = params.transfer === '1'
  const error = typeof params.error === 'string' ? params.error : ''

  const [leads, openLead, assignableProfiles, activities, leadTasks, ownerTasks] = await Promise.all([
    getMyLeads(user!.id, 120),
    openLeadId ? getLeadById(openLeadId) : Promise.resolve(null),
    getLeadAssignableProfiles(),
    openLeadId ? getActivityLog('lead', openLeadId, 50) : Promise.resolve([]),
    openLeadId ? getTasksByLead(openLeadId, 10) : Promise.resolve([]),
    getTasksForOwner(user!.id, 80),
  ])
  const aiScript = activities.find((activity) => activity.event_type === 'ai_sales_script_generated') ?? null
  const historyActivities = activities.filter((activity) => activity.event_type !== 'ai_sales_script_generated')
  const scripts = openLead?.desired_program?.segment ? await getSalesScriptsBySegment(openLead.desired_program.segment, 6) : []

  return (
    <div className="content-stack compact-page fullscreen-stretch leads-fullscreen-page">
      <section className="section-head leads-section-head leads-section-head--tight">
        <div>
          <h1 className="page-title">Мои лиды</h1>
          <p className="muted">Персональная очередь клиентов и ежедневные дела менеджера на одной странице.</p>
        </div>
        <div className="form-actions">
          <Link className="button-secondary" href="/dashboard/leads">Свободные лиды</Link>
        </div>
      </section>

      {error ? <div className="notice notice-danger">{error}</div> : null}

      <div className={`deal-workspace ${openLead ? 'is-open' : ''}`}>
        <article className="card stack leads-registry-card my-clients-card">
          <div className="inline-card leads-inline-card">
            <div>
              <h2 style={{ margin: 0 }}>Мои клиенты</h2>
              <div className="micro">Откройте клиента: действия появятся сразу под строкой, скрипты открываются отдельно справа.</div>
            </div>
            <div className="compact-badges">
              <span className="badge">Всего: {leads.length}</span>
              <span className="badge">Взято в работу: {leads.length}</span>
            </div>
          </div>
          <LeadRegistryTable
            leads={leads}
            updateStatusAction={updateLeadStatus}
            openBasePath="/dashboard/my-leads"
            statusEditable={false}
            selectedLeadId={openLead?.id}
            expandedRow={openLead ? (
              <MyLeadActionPanel
                lead={openLead}
                assignableProfiles={assignableProfiles}
                mode={dealMode ? 'deal' : transferMode ? 'transfer' : 'default'}
                activities={historyActivities}
                tasks={leadTasks}
              />
            ) : null}
          />
        </article>

        {openLead ? (
          <LeadWorkspaceDrawer
            lead={openLead}
            scripts={scripts}
            aiScript={aiScript}
            assignableProfiles={assignableProfiles}
            scriptsMode={scriptsMode}
            returnPath="/dashboard/my-leads"
          />
        ) : null}
      </div>

      <MyTasksSection tasks={ownerTasks} />

    </div>
  )
}
