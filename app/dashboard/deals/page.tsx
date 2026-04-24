import Link from 'next/link'
import { completeDealPaymentAndMoveAction, completeDealTaskAction, createDeal, createDealNoteAction, createDealTaskAction, transferDealOwnerAction, updateDealContextAction, updateDealPaymentProgressAction, updateDealStage } from './actions'
import { ProcessTrail } from '@/components/process-trail'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { DealRegistryTable } from '@/components/deal-registry-table'
import { getActivityLog, getAssignableManagers, getAuditTrail, getDealById, getDealFlowSummaries, getDeals, getDepartures, getPartnerAccounts, getPaymentsByDeal, getPrograms, getRecentLeads, getTasksByDeal } from '@/lib/queries'

function leadInterestLine(deal: Awaited<ReturnType<typeof getDealById>>) {
  if (!deal) return 'Интерес не указан'
  return deal.lead?.desired_program?.title || deal.program?.title || deal.lead?.desired_country || deal.departure?.departure_name || 'Интерес не указан'
}

const pipelineStages = ['qualified', 'proposal', 'negotiation', 'won', 'lost']

function dealPaymentState(flow: Awaited<ReturnType<typeof getDealFlowSummaries>>[string] | undefined, fallbackAmount = 0) {
  const amount = flow?.payment_amount || fallbackAmount || 0
  const paid = flow?.payment_paid_amount || 0
  return {
    amount,
    paid,
    remaining: Math.max(0, amount - paid),
    isPaid: amount > 0 && paid >= amount,
    isPartial: paid > 0 && paid < amount,
  }
}

function dealNextStep(flow: Awaited<ReturnType<typeof getDealFlowSummaries>>[string] | undefined, fallbackAmount = 0, currency = 'RUB') {
  const payment = dealPaymentState(flow, fallbackAmount)
  if (!flow?.contract_id) return { tone: 'danger', title: 'Нужен договор', text: 'Создайте договор и привяжите его к сделке.' }
  if (flow.contract_status !== 'signed') return { tone: 'warning', title: 'Ждём подпись', text: 'Договор есть, но ещё не подписан клиентом.' }
  if (!payment.isPaid) return { tone: payment.isPartial ? 'warning' : 'danger', title: payment.isPartial ? 'Доплатить остаток' : 'Ждём оплату', text: payment.isPartial ? `Осталось ${formatCurrency(payment.remaining, currency)}.` : 'Зафиксируйте частичную или полную оплату.' }
  if (!flow.application_id) return { tone: 'warning', title: 'Передать в участники', text: 'Договор подписан и оплата закрыта. Создайте участника выезда.' }
  return { tone: 'success', title: 'Готово к выезду', text: 'Клиент уже переведён в участники.' }
}

function dealBottleneckKey(flow: Awaited<ReturnType<typeof getDealFlowSummaries>>[string] | undefined, fallbackAmount = 0) {
  const payment = dealPaymentState(flow, fallbackAmount)
  if (!flow?.contract_id) return 'contract'
  if (flow.contract_status !== 'signed') return 'signature'
  if (!payment.isPaid) return payment.isPartial ? 'remainder' : 'payment'
  if (!flow.application_id) return 'application'
  return 'done'
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const created = typeof params.created === 'string' ? params.created : ''
  const error = typeof params.error === 'string' ? params.error : ''
  const openDealId = typeof params.open === 'string' ? params.open : created
  const payMode = params.pay === '1'

  const [deals, leads, createdDeal, openDeal, programs, departures, partnerAccounts, managers, openPayments, openTasks, openActivities, openAuditTrail] = await Promise.all([
    getDeals(40),
    getRecentLeads(50),
    created ? getDealById(created) : Promise.resolve(null),
    openDealId ? getDealById(openDealId) : Promise.resolve(null),
    openDealId ? getPrograms(100) : Promise.resolve([]),
    openDealId ? getDepartures(100) : Promise.resolve([]),
    openDealId ? getPartnerAccounts(100) : Promise.resolve([]),
    openDealId ? getAssignableManagers(100) : Promise.resolve([]),
    openDealId ? getPaymentsByDeal(openDealId, 20) : Promise.resolve([]),
    openDealId ? getTasksByDeal(openDealId, 10) : Promise.resolve([]),
    openDealId ? getActivityLog('deal', openDealId, 20) : Promise.resolve([]),
    openDealId ? getAuditTrail('deal', openDealId, 20) : Promise.resolve([]),
  ])

  const visibleDeals = createdDeal && !deals.some((deal) => deal.id === createdDeal.id) ? [createdDeal, ...deals] : deals
  const flowByDealId = await getDealFlowSummaries(visibleDeals.map((deal) => deal.id))
  const bottleneckGroups = {
    contract: visibleDeals.filter((deal) => dealBottleneckKey(flowByDealId[deal.id], Number(deal.estimated_value ?? 0)) === 'contract'),
    signature: visibleDeals.filter((deal) => dealBottleneckKey(flowByDealId[deal.id], Number(deal.estimated_value ?? 0)) === 'signature'),
    payment: visibleDeals.filter((deal) => dealBottleneckKey(flowByDealId[deal.id], Number(deal.estimated_value ?? 0)) === 'payment'),
    remainder: visibleDeals.filter((deal) => dealBottleneckKey(flowByDealId[deal.id], Number(deal.estimated_value ?? 0)) === 'remainder'),
    application: visibleDeals.filter((deal) => dealBottleneckKey(flowByDealId[deal.id], Number(deal.estimated_value ?? 0)) === 'application'),
    done: visibleDeals.filter((deal) => dealBottleneckKey(flowByDealId[deal.id], Number(deal.estimated_value ?? 0)) === 'done'),
  }
  const openFlow = openDeal ? flowByDealId[openDeal.id] : undefined
  const openPaymentState = openDeal ? dealPaymentState(openFlow, Number(openDeal.estimated_value ?? 0)) : null
  const openNextStep = openDeal ? dealNextStep(openFlow, Number(openDeal.estimated_value ?? 0), openDeal.currency || 'RUB') : null
  const openContractSigned = openFlow?.contract_status === 'signed'
  const openCanMoveToApplication = Boolean(openContractSigned && openPaymentState?.amount && !openFlow?.application_id)
  const matchingDepartures = openDeal?.program_id
    ? departures.filter((departure) => departure.program_id === openDeal.program_id || departure.id === openDeal.departure_id)
    : departures

  return (
    <div className="content-stack compact-page fullscreen-stretch">
      <section className="section-head">
        <div>
          <h1 className="page-title">Сделки</h1>
          <p className="muted">Сделка ведёт клиента до договора, оплаты и передачи в участников выезда. Оплата фиксируется прямо здесь, без отдельного раздела финансов.</p>
        </div>
      </section>

      <ProcessTrail
        items={[
          { label: 'Лиды', href: '/dashboard/leads' },
          { label: 'Сделки', href: '/dashboard/deals' },
          { label: 'Договоры', href: '/dashboard/contracts' },
          { label: 'Участники', href: '/dashboard/applications' },
        ]}
        current="Сделки"
      />

      {created ? (
        <div className="notice">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Сделка создана</div>
          <div className="micro">Новая запись добавлена в рабочий реестр ниже и раскрыта в правой панели.</div>
        </div>
      ) : null}

      {error ? (
        <div className="notice notice-danger">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Не удалось обработать сделку</div>
          <div className="micro">{error}</div>
        </div>
      ) : null}

      <article className="card stack">
        <div className="compact-toolbar">
          <div>
            <h2 style={{ margin: 0 }}>Создать сделку наверху</h2>
            <div className="micro">Лид можно выбрать вручную. Если нажать «Взять» на странице лидов, сделка создастся у текущего менеджера автоматически и тоже появится здесь.</div>
          </div>
        </div>
        <form action={createDeal}>
          <div className="compact-form-grid compact-form-grid--deals-top">
            <label>
              Лид
              <select name="lead_id" defaultValue="">
                <option value="">Без привязки</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>{(lead.contact_name_raw || 'Без имени') + ' · ' + (lead.desired_program?.title || lead.desired_country || lead.source_channel)}</option>
                ))}
              </select>
            </label>
            <label>Название сделки<input name="title" placeholder="Англия · business English · Ивановы" required /></label>
            <label>
              Стадия
              <select name="stage" defaultValue="qualified">
                <option value="qualified">Квалифицирована</option>
                <option value="proposal">Предложение</option>
                <option value="negotiation">Переговоры</option>
                <option value="won">Выиграна</option>
                <option value="lost">Потеряна</option>
              </select>
            </label>
            <label>Сумма<input name="estimated_value" type="number" min="0" step="1000" placeholder="180000" /></label>
            <label>Участников<input name="participants_count" type="number" min="1" defaultValue="1" /></label>
            <label>Планируемое закрытие<input name="close_date" type="date" /></label>
            <label style={{ gridColumn: '1 / -1' }}>Комментарий<textarea name="notes" placeholder="Коротко: что обещано клиенту и что нужно дожать" /></label>
          </div>
          <div className="form-actions"><button className="button">Создать сделку</button></div>
        </form>
      </article>

      <section className="grid-3 compact-stat-grid">
        <article className="card stack"><div className="micro">Активные сделки в продаже</div><div className="kpi-value">{visibleDeals.length}</div></article>
        <article className="card stack"><div className="micro">На активных стадиях</div><div className="kpi-value">{visibleDeals.filter((deal) => ['qualified', 'proposal', 'negotiation'].includes(deal.stage)).length}</div></article>
        <article className="card stack"><div className="micro">Сумма по активным сделкам</div><div className="kpi-value">{formatCurrency(visibleDeals.reduce((sum, deal) => sum + Number(deal.estimated_value ?? 0), 0), 'RUB')}</div></article>
      </section>

      <article className="card stack">
        <div className="section-mini-head">
          <div>
            <h2>Узкие места</h2>
            <div className="micro">Операционный срез по сделкам: что мешает перевести клиента дальше.</div>
          </div>
          <span className="badge">В работе: {visibleDeals.length - bottleneckGroups.done.length}</span>
        </div>
        <div className="deal-bottleneck-grid">
          {[
            { key: 'contract', title: 'Нужен договор', tone: 'danger', deals: bottleneckGroups.contract },
            { key: 'signature', title: 'Ждём подпись', tone: 'warning', deals: bottleneckGroups.signature },
            { key: 'payment', title: 'Ждём оплату', tone: 'danger', deals: bottleneckGroups.payment },
            { key: 'remainder', title: 'Доплата', tone: 'warning', deals: bottleneckGroups.remainder },
            { key: 'application', title: 'Создать участника', tone: 'warning', deals: bottleneckGroups.application },
            { key: 'done', title: 'Готово', tone: 'success', deals: bottleneckGroups.done },
          ].map((group) => (
            <div key={group.key} className={`deal-bottleneck-card deal-bottleneck-card--${group.tone}`}>
              <div className="deal-bottleneck-card__head">
                <span>{group.title}</span>
                <strong>{group.deals.length}</strong>
              </div>
              <div className="deal-bottleneck-list">
                {group.deals.slice(0, 3).map((deal) => (
                  <Link key={deal.id} href={`/dashboard/deals?open=${deal.id}#deal-editor`}>
                    <span>{deal.title}</span>
                    <small>{deal.lead?.contact_name_raw || deal.account?.display_name || formatCurrency(deal.estimated_value, deal.currency || 'RUB')}</small>
                  </Link>
                ))}
                {group.deals.length > 3 ? <div className="micro">+ ещё {group.deals.length - 3}</div> : null}
                {!group.deals.length ? <div className="micro">Нет сделок</div> : null}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="card stack">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <div>
            <h2 style={{ margin: 0 }}>Воронка сделок</h2>
            <div className="micro">Канбан по стадиям: видно, где застряли клиенты, и можно быстро перевести сделку дальше.</div>
          </div>
        </div>
        <div className="deal-kanban">
          {pipelineStages.map((stage) => {
            const stageDeals = visibleDeals.filter((deal) => deal.stage === stage)
            const stageSum = stageDeals.reduce((sum, deal) => sum + Number(deal.estimated_value ?? 0), 0)
            return (
              <section key={stage} className="deal-kanban-column">
                <div className="deal-kanban-column__head">
                  <div>
                    <h3>{label('dealStage', stage)}</h3>
                    <div className="micro">{stageDeals.length} сделок · {formatCurrency(stageSum, 'RUB')}</div>
                  </div>
                </div>
                <div className="deal-kanban-cards">
                  {stageDeals.length ? stageDeals.map((deal) => {
                    const flow = flowByDealId[deal.id]
                    const paid = Boolean(flow?.payment_amount && flow.payment_paid_amount >= flow.payment_amount)
                    return (
                      <div key={deal.id} className="deal-kanban-card">
                        <Link href={`/dashboard/deals?open=${deal.id}#deal-editor`}>
                          <strong>{deal.title}</strong>
                          <div className="micro">{deal.lead?.contact_name_raw || deal.account?.display_name || 'Без клиента'}</div>
                          <div className="micro">{formatCurrency(deal.estimated_value, deal.currency || 'RUB')}</div>
                        </Link>
                        <div className="badge-row">
                          <span className="badge">{flow?.contract_status ? label('contractStatus', flow.contract_status) : 'Без договора'}</span>
                          <span className={`badge ${paid ? 'success' : ''}`}>{paid ? 'Оплачено' : flow?.payment_paid_amount ? 'Частично' : 'Без оплаты'}</span>
                        </div>
                        <form action={updateDealStage} className="deal-kanban-stage-form">
                          <input type="hidden" name="deal_id" value={deal.id} />
                          <select name="stage" defaultValue={deal.stage}>
                            {pipelineStages.map((option) => <option key={option} value={option}>{label('dealStage', option)}</option>)}
                          </select>
                          <button className="button-secondary">Перевести</button>
                        </form>
                      </div>
                    )
                  }) : <div className="muted">Пусто</div>}
                </div>
              </section>
            )
          })}
        </div>
      </article>

      <div className={`deal-workspace ${openDeal ? 'is-open' : ''}`}>
        <article className="card stack">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div>
              <h2 style={{ margin: 0 }}>Реестр сделок</h2>
              <div className="micro">Видно, есть ли договор, сколько оплачено и готов ли клиент к передаче в участников выезда.</div>
            </div>
          </div>
          {visibleDeals.length ? (
            <DealRegistryTable deals={visibleDeals} openDealId={openDeal?.id} flowByDealId={flowByDealId} />
          ) : (
            <div className="notice">Активных сделок в продаже сейчас нет. Новые сделки появляются здесь после создания вручную или из кнопки «Взять» у лида.</div>
          )}
        </article>

        {openDeal ? (
          <aside id="deal-editor" className="card stack deal-editor-drawer">
            <div className="compact-toolbar">
              <div>
                <div className="micro">Боковая редакция сделки</div>
                <h2 style={{ margin: 0 }}>{openDeal.title}</h2>
                <div className="micro">Панель открывается справа и остаётся в зоне видимости, чтобы не уводить тебя на отдельную страницу.</div>
              </div>
              <div className="compact-badges">
                <span className="badge success">{label('dealStage', openDeal.stage)}</span>
                <span className="badge">{formatCurrency(openDeal.estimated_value, openDeal.currency)}</span>
              </div>
            </div>

            <div className="deal-drawer-meta-grid">
              <div className="card-subtle">
                <div className="micro">Контакт</div>
                <strong>{openDeal.lead?.contact_name_raw || openDeal.account?.display_name || 'Без клиента'}</strong>
                <div className="micro">{openDeal.lead?.phone_raw || openDeal.lead?.email_raw || 'Контакты не заполнены'}</div>
              </div>
              <div className="card-subtle">
                <div className="micro">Выбор лида</div>
                <strong>{leadInterestLine(openDeal)}</strong>
                <div className="micro">{openDeal.lead?.desired_departure?.departure_name || openDeal.departure?.departure_name || 'Выезд не выбран'}</div>
              </div>
            </div>

            <div className="card-subtle stack">
              <div className="micro">Что пришло из лида</div>
              <div className="compact-note-list">
                <div><strong>Канал:</strong> <span className="micro-inline">{openDeal.lead?.source_channel || 'Не указан'}</span></div>
                <div><strong>Страна / интерес:</strong> <span className="micro-inline">{openDeal.lead?.desired_country || openDeal.lead?.desired_program?.title || 'Не указан'}</span></div>
                <div><strong>Комментарий лида:</strong> <span className="micro-inline">{openDeal.lead?.message || 'Пусто'}</span></div>
              </div>
            </div>

            <div className="card-subtle stack">
              <h3 style={{ margin: 0 }}>Лента сделки</h3>
              <form action={createDealNoteAction} className="compact-form-grid compact-form-grid--lead-note">
                <input type="hidden" name="deal_id" value={openDeal.id} />
                <label>Тип заметки<input name="title" placeholder="Звонок / договор / оплата" defaultValue="Комментарий менеджера" /></label>
                <label className="lead-note-field">Комментарий<textarea name="note" placeholder="Что произошло по сделке" required /></label>
                <div className="form-actions"><button className="button-secondary">Добавить</button></div>
              </form>
              <div id="deal-timeline" className="lead-task-list">
                {openActivities.length ? openActivities.map((activity) => (
                  <div key={activity.id} className="lead-task-item">
                    <div>
                      <strong>{activity.title}</strong>
                      <div className="micro">{formatDateTime(activity.created_at)} · {activity.actor?.full_name || activity.actor?.email || 'система'}</div>
                      {activity.body ? <div className="micro" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{activity.body}</div> : null}
                    </div>
                  </div>
                )) : <div className="micro">Лента сделки пока пустая.</div>}
              </div>
            </div>

            <div className="card-subtle stack">
              <h3 style={{ margin: 0 }}>Аудит изменений</h3>
              {openAuditTrail.length ? (
                <div className="lead-task-list">
                  {openAuditTrail.map((row) => {
                    const changed = row.changed_fields && typeof row.changed_fields === 'object' ? Object.entries(row.changed_fields) : []
                    return (
                      <details key={row.id} className="lead-audit-item">
                        <summary>
                          <strong>{row.action === 'insert' ? 'Создание записи' : row.action === 'delete' ? 'Удаление записи' : 'Обновление полей'}</strong>
                          <span className="micro">{formatDateTime(row.created_at)} · {row.actor?.full_name || row.actor?.email || 'система'}</span>
                        </summary>
                        <div className="lead-audit-item__body">
                          {changed.length ? changed.map(([field, values]) => (
                            <div key={field} className="lead-audit-change">
                              <strong>{field}</strong>
                              <div className="micro" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(values)}</div>
                            </div>
                          )) : <div className="micro">Изменения по полям не требуются для этой операции.</div>}
                        </div>
                      </details>
                    )
                  })}
                </div>
              ) : <div className="micro">Аудит пока пустой.</div>}
            </div>

            <div className="card-subtle stack">
              <h3 style={{ margin: 0 }}>Следующее действие</h3>
              <form action={createDealTaskAction} className="compact-form-grid compact-form-grid--lead-task">
                <input type="hidden" name="deal_id" value={openDeal.id} />
                <label>Что сделать<input name="title" placeholder="Отправить договор / проверить оплату" required /></label>
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
              {openTasks.length ? (
                <div className="lead-task-list">
                  {openTasks.map((task) => (
                    <form key={task.id} action={completeDealTaskAction} className="lead-task-item">
                      <input type="hidden" name="deal_id" value={openDeal.id} />
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="title" value={task.title} />
                      <div>
                        <strong>{task.title}</strong>
                        <div className="micro">{task.due_date ? formatDate(task.due_date) : 'Без срока'} · {label('priority', task.priority)}</div>
                      </div>
                      <button className="button-secondary">Готово</button>
                    </form>
                  ))}
                </div>
              ) : <div className="micro">Открытых задач по сделке пока нет.</div>}
            </div>

            <form action={transferDealOwnerAction}>
              <input type="hidden" name="deal_id" value={openDeal.id} />
              <div className="compact-form-grid compact-form-grid--drawer-single">
                <label>
                  Передать другому менеджеру
                  <select name="owner_user_id" defaultValue={openDeal.owner_user_id || ''}>
                    <option value="">Без ответственного</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>{manager.full_name || manager.email || manager.id}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-actions"><button className="button-secondary">Сохранить менеджера</button></div>
            </form>

            <form action={updateDealContextAction}>
              <input type="hidden" name="deal_id" value={openDeal.id} />
              <input type="hidden" name="lead_id" value={openDeal.lead_id || ''} />
              <div className="compact-form-grid compact-form-grid--drawer">
                <label>Название сделки<input name="title" defaultValue={openDeal.title} /></label>
                <label>
                  Программа
                  <select name="program_id" defaultValue={openDeal.program_id || ''}>
                    <option value="">Без программы</option>
                    {programs.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}
                  </select>
                </label>
                <label>
                  Выезд
                  <select name="departure_id" defaultValue={openDeal.departure_id || ''}>
                    <option value="">Без выезда</option>
                    {matchingDepartures.map((departure) => <option key={departure.id} value={departure.id}>{departure.departure_name} · {formatDate(departure.start_date)}</option>)}
                  </select>
                </label>
                <label>
                  Партнёр
                  <select name="partner_account_id" defaultValue={openDeal.partner_account_id || ''}>
                    <option value="">Без партнёра</option>
                    {partnerAccounts.map((account) => <option key={account.id} value={account.id}>{account.display_name}</option>)}
                  </select>
                </label>
                <label>Сумма<input name="estimated_value" type="number" min="0" step="1000" defaultValue={openDeal.estimated_value ?? ''} /></label>
                <label>Участников<input name="participants_count" type="number" min="1" defaultValue={openDeal.participants_count} /></label>
                <label>План закрытия<input name="close_date" type="date" defaultValue={openDeal.close_date || ''} /></label>
                <label style={{ gridColumn: '1 / -1' }}>Примечания<textarea name="notes" defaultValue={openDeal.notes || ''} /></label>
              </div>
              <div className="micro">Как только у сделки появляется сумма, система готовит строку оплаты. Договор создаётся отдельной кнопкой и привязывается к этой сделке.</div>
              <div className="form-actions"><button className="button">Сохранить контекст сделки</button></div>
            </form>

            <div className="card-subtle stack">
              <div className="deal-readiness-panel">
                <div className={`deal-readiness-step ${openFlow?.contract_id ? 'is-done' : 'is-blocked'}`}>
                  <div className="micro">Договор</div>
                  <strong>{openFlow?.contract_status ? label('contractStatus', openFlow.contract_status) : 'Не создан'}</strong>
                  <span>{openFlow?.contract_signed_at ? `подписан ${formatDate(openFlow.contract_signed_at)}` : 'нужен для запуска оплаты'}</span>
                </div>
                <div className={`deal-readiness-step ${openPaymentState?.isPaid ? 'is-done' : openPaymentState?.isPartial ? 'is-waiting' : 'is-blocked'}`}>
                  <div className="micro">Оплата</div>
                  <strong>{openPaymentState?.isPaid ? 'Оплачено' : openPaymentState?.isPartial ? 'Частично' : 'Нет оплаты'}</strong>
                  <span>{formatCurrency(openPaymentState?.paid || 0, openDeal.currency)} / {formatCurrency(openPaymentState?.amount || 0, openDeal.currency)}</span>
                </div>
                <div className={`deal-readiness-step ${openFlow?.application_id ? 'is-done' : 'is-waiting'}`}>
                  <div className="micro">Участник</div>
                  <strong>{openFlow?.application_id ? 'Создан' : 'Не создан'}</strong>
                  <span>{openFlow?.application_id ? 'клиент в разделе участников' : 'после договора и оплаты'}</span>
                </div>
              </div>
              {openNextStep ? (
                <div className={`deal-next-step deal-next-step--${openNextStep.tone}`}>
                  <div>
                    <div className="micro">Следующий шаг</div>
                    <strong>{openNextStep.title}</strong>
                    <div>{openNextStep.text}</div>
                  </div>
                  <div className="form-actions">
                    {!openFlow?.contract_id ? <Link className="button-secondary" href={`/dashboard/contracts?deal_id=${openDeal.id}`}>Создать договор</Link> : null}
                    {openFlow?.contract_id && openFlow.contract_status !== 'signed' ? <Link className="button-secondary" href={`/dashboard/contracts/${openFlow.contract_id}`}>Открыть договор</Link> : null}
                    {openFlow?.contract_status === 'signed' && !openPaymentState?.isPaid ? <Link className="button-secondary" href={`/dashboard/deals?open=${openDeal.id}&pay=1#deal-payment-popover`}>Внести оплату</Link> : null}
                    {openFlow?.contract_status === 'signed' && openPaymentState?.isPaid && !openFlow?.application_id ? <Link className="button-secondary" href={`/dashboard/deals?open=${openDeal.id}&pay=1#deal-payment-popover`}>Создать участника</Link> : null}
                  </div>
                </div>
              ) : null}

              <div className="compact-toolbar">
                <div>
                  <h3 style={{ margin: 0 }}>Договор и оплата</h3>
                  <div className="micro">
                    {flowByDealId[openDeal.id]?.contract_status
                      ? `Договор: ${label('contractStatus', flowByDealId[openDeal.id].contract_status || '')}`
                      : 'Добавьте договор к сделке, затем фиксируйте оплату здесь.'}
                  </div>
                </div>
                <div className="form-actions">
                  <Link className="button-secondary" href={`/dashboard/contracts?deal_id=${openDeal.id}`}>Договор</Link>
                  <Link className="button-secondary" href={`/dashboard/deals?open=${openDeal.id}&pay=1#deal-payment-popover`}>Оплата</Link>
                </div>
              </div>

              {payMode ? (
                <div id="deal-payment-popover" className="lead-inline-form">
                  <h3 style={{ margin: 0 }}>Оплата по сделке</h3>
                  <div className="deal-blocker-list">
                    <div className={openFlow?.contract_id ? 'is-done' : 'is-blocked'}>
                      <strong>Договор</strong>
                      <span>{openFlow?.contract_id ? 'создан' : 'сначала создайте договор'}</span>
                    </div>
                    <div className={openContractSigned ? 'is-done' : 'is-blocked'}>
                      <strong>Подпись</strong>
                      <span>{openContractSigned ? 'договор подписан' : 'перевод в участники заблокирован'}</span>
                    </div>
                    <div className={openPaymentState?.amount ? 'is-done' : 'is-blocked'}>
                      <strong>Сумма</strong>
                      <span>{openPaymentState?.amount ? formatCurrency(openPaymentState.amount, openDeal.currency) : 'укажите сумму сделки'}</span>
                    </div>
                  </div>
                  <div className="badge-row">
                    <span className={`badge ${flowByDealId[openDeal.id]?.payment_amount && flowByDealId[openDeal.id].payment_paid_amount >= flowByDealId[openDeal.id].payment_amount ? 'success' : ''}`}>
                      {flowByDealId[openDeal.id]?.payment_amount && flowByDealId[openDeal.id].payment_paid_amount >= flowByDealId[openDeal.id].payment_amount ? 'Оплачено' : flowByDealId[openDeal.id]?.payment_paid_amount ? 'Частично оплачено' : 'Ожидает оплаты'}
                    </span>
                    <span className="badge">{formatCurrency(flowByDealId[openDeal.id]?.payment_paid_amount || 0, openDeal.currency)} / {formatCurrency(flowByDealId[openDeal.id]?.payment_amount || openDeal.estimated_value || 0, openDeal.currency)}</span>
                  </div>
                  {openPayments.length ? (
                    <form action={updateDealPaymentProgressAction}>
                      <input type="hidden" name="deal_id" value={openDeal.id} />
                      <label>
                        Платёж
                        <select name="payment_id" defaultValue={openPayments[0]?.id}>
                          {openPayments.map((payment) => (
                            <option key={payment.id} value={payment.id}>{payment.label} · {formatCurrency(payment.amount, payment.currency)}</option>
                          ))}
                        </select>
                      </label>
                      <label>Клиент внёс<input name="paid_amount" type="number" min="0" step="1000" defaultValue={flowByDealId[openDeal.id]?.payment_paid_amount || 0} /></label>
                      <div className="form-actions"><button className="button-secondary">Частично оплачено</button></div>
                    </form>
                  ) : <div className="notice">Платёж появится после сохранения суммы сделки. Если суммы ещё нет, укажите её в редакции выше.</div>}
                  {openCanMoveToApplication ? (
                    <form action={completeDealPaymentAndMoveAction}>
                      <input type="hidden" name="deal_id" value={openDeal.id} />
                      <div className="form-actions"><button className="button">Оплачено полностью и создать участника</button></div>
                    </form>
                  ) : (
                    <div className="notice">Кнопка полного перевода появится после подписанного договора и указанной суммы сделки.</div>
                  )}
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
