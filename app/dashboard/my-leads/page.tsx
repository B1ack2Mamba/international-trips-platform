import Link from 'next/link'
import { completeLeadTaskAction, convertLeadToDeal, createLeadTaskAction, generateLeadScriptAction, transferLeadOwner, updateLeadStatus } from '@/app/dashboard/leads/actions'
import { LeadRegistryTable } from '@/components/lead-registry-table'
import { LeadWorkspaceDrawer } from '@/components/lead-workspace-drawer'
import { getLeadAssignableProfiles, type LeadAssignableProfile } from '@/lib/lead-access'
import { requireDashboardAccess } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { getActivityLog, getContractsByDeal, getDealById, getDealFlowSummaries, getLeadById, getLeadCommunications, getMyLeads, getPaymentsByDeal, getSalesScriptsBySegment, getTasksByLead, type LeadRow, type TaskRow } from '@/lib/queries'

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
            <h3>Дела по клиенту</h3>
            <div className="micro">Создавайте задачи по этому человеку и закрывайте их прямо здесь.</div>
          </div>
          <span className="badge">Задач: {tasks.length}</span>
        </div>
        <form action={createLeadTaskAction} className="compact-form-grid compact-form-grid--lead-task">
          <input type="hidden" name="lead_id" value={lead.id} />
          <label>Задача<input name="title" placeholder="Позвонить и согласовать договор" required /></label>
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
          <label className="lead-task-description-field">Описание<textarea name="description" placeholder="Коротко: что сделать и какой результат нужен" /></label>
          <div className="form-actions"><button className="button-secondary">Создать задачу</button></div>
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
    </div>
  )
}

function LeadHistorySection({ lead, activities }: { lead: LeadRow | null; activities: Awaited<ReturnType<typeof getActivityLog>> }) {
  return (
    <article id="lead-history" className="card stack">
      <div className="section-mini-head">
        <div>
          <h2>История действий</h2>
          <div className="micro">{lead ? `Клиент: ${lead.contact_name_raw || 'Без имени'}` : 'Откройте клиента, чтобы увидеть историю.'}</div>
        </div>
        {lead ? <span className="badge">Событий: {activities.length}</span> : null}
      </div>
      {lead && activities.length ? (
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
      ) : <div className="notice">{lead ? 'История пока пустая.' : 'Выберите клиента в таблице выше.'}</div>}
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

  const [leads, openLead, assignableProfiles, activities, leadTasks, communications] = await Promise.all([
    getMyLeads(user!.id, 120),
    openLeadId ? getLeadById(openLeadId) : Promise.resolve(null),
    getLeadAssignableProfiles(),
    openLeadId ? getActivityLog('lead', openLeadId, 50) : Promise.resolve([]),
    openLeadId ? getTasksByLead(openLeadId, 10) : Promise.resolve([]),
    openLeadId ? getLeadCommunications(openLeadId, 40) : Promise.resolve([]),
  ])
  const aiScript = activities.find((activity) => activity.event_type === 'ai_sales_script_generated') ?? null
  const historyActivities = activities.filter((activity) => activity.event_type !== 'ai_sales_script_generated')
  const scripts = openLead?.desired_program?.segment ? await getSalesScriptsBySegment(openLead.desired_program.segment, 6) : []
  const deal = openLead?.converted_deal_id ? await getDealById(openLead.converted_deal_id) : null
  const dealFlowById = deal ? await getDealFlowSummaries([deal.id]) : {}
  const contracts = deal ? await getContractsByDeal(deal.id, 5) : []
  const payments = deal ? await getPaymentsByDeal(deal.id, 5) : []
  const dealFlow = deal ? dealFlowById[deal.id] ?? null : null

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
            deal={deal}
            dealFlow={dealFlow}
            contracts={contracts}
            payments={payments}
            tasks={leadTasks}
            communications={communications}
            assignableProfiles={assignableProfiles}
            scriptsMode={scriptsMode}
            returnPath="/dashboard/my-leads"
          />
        ) : null}
      </div>

      <LeadHistorySection lead={openLead} activities={historyActivities} />

    </div>
  )
}
