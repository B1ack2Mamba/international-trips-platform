import { createDeal, transferDealOwnerAction, updateDealContextAction } from './actions'
import { ProcessTrail } from '@/components/process-trail'
import { formatCurrency, formatDate } from '@/lib/format'
import { label } from '@/lib/labels'
import { DealRegistryTable } from '@/components/deal-registry-table'
import { getAssignableManagers, getDealById, getDeals, getDepartures, getPartnerAccounts, getPrograms, getRecentLeads } from '@/lib/queries'

function leadInterestLine(deal: Awaited<ReturnType<typeof getDealById>>) {
  if (!deal) return 'Интерес не указан'
  return deal.lead?.desired_program?.title || deal.program?.title || deal.lead?.desired_country || deal.departure?.departure_name || 'Интерес не указан'
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

  const [deals, leads, createdDeal, openDeal, programs, departures, partnerAccounts, managers] = await Promise.all([
    getDeals(40),
    getRecentLeads(50),
    created ? getDealById(created) : Promise.resolve(null),
    openDealId ? getDealById(openDealId) : Promise.resolve(null),
    openDealId ? getPrograms(100) : Promise.resolve([]),
    openDealId ? getDepartures(100) : Promise.resolve([]),
    openDealId ? getPartnerAccounts(100) : Promise.resolve([]),
    openDealId ? getAssignableManagers(100) : Promise.resolve([]),
  ])

  const visibleDeals = createdDeal && !deals.some((deal) => deal.id === createdDeal.id) ? [createdDeal, ...deals] : deals
  const matchingDepartures = openDeal?.program_id
    ? departures.filter((departure) => departure.program_id === openDeal.program_id || departure.id === openDeal.departure_id)
    : departures

  return (
    <div className="content-stack compact-page fullscreen-stretch">
      <section className="section-head">
        <div>
          <h1 className="page-title">Сделки</h1>
          <p className="muted">Сделка живёт здесь как главный рабочий объект. После установки суммы запись сразу появляется в финансах, а справа раскрывается компактная редакция с данными лида, менеджером и контекстом сделки.</p>
        </div>
      </section>

      <ProcessTrail
        items={[
          { label: 'Лиды', href: '/dashboard/leads' },
          { label: 'Сделки', href: '/dashboard/deals' },
          { label: 'Финансы', href: '/dashboard/finance' },
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

      <div className={`deal-workspace ${openDeal ? 'is-open' : ''}`}>
        <article className="card stack">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div>
              <h2 style={{ margin: 0 }}>Реестр сделок</h2>
              <div className="micro">Плотный рабочий режим: главное видеть контакт, интерес, менеджера и быстрый переход в финансы без лишней высоты строк.</div>
            </div>
          </div>
          {visibleDeals.length ? (
            <DealRegistryTable deals={visibleDeals} openDealId={openDeal?.id} />
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
              <div className="micro">Как только у сделки появляется сумма, в финреестре автоматически появляется строка платежа, а в фоновой очереди создаётся задача на договор.</div>
              <div className="form-actions"><button className="button">Сохранить контекст сделки</button></div>
            </form>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
