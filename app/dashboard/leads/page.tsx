import Link from 'next/link'
import { convertLeadToDeal, createLead, takeLead, updateLeadStatus } from './actions'
import { channelOptions, label } from '@/lib/labels'
import { LeadRegistryTable } from '@/components/lead-registry-table'
import { getLeadById, getRecentLeads, getSalesScriptsBySegment } from '@/lib/queries'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const openLeadId = typeof params.open === 'string' ? params.open : ''
  const scriptsMode = params.scripts === '1'
  const readyMode = params.ready === '1'

  const [leads, openLead] = await Promise.all([
    getRecentLeads(80),
    openLeadId ? getLeadById(openLeadId) : Promise.resolve(null),
  ])
  const activeLeads = leads.filter((lead) => !lead.converted_deal_id)
  const archivedLeadsCount = leads.length - activeLeads.length
  const scripts = openLead?.desired_program?.segment ? await getSalesScriptsBySegment(openLead.desired_program.segment, 6) : []

  return (
    <div className="content-stack compact-page fullscreen-stretch leads-fullscreen-page">
      <section className="section-head leads-section-head leads-section-head--tight">
        <div>
          <h1 className="page-title">Лиды</h1>
          <p className="muted">Плотный экран без лишней вертикали: сверху быстрый ввод, ниже единая лента. Кнопка «Взять» сразу забирает лида в работу и создаёт сделку у текущего менеджера.</p>
        </div>
      </section>

      <article className="card stack leads-create-card">
        <div className="compact-toolbar leads-create-toolbar">
          <div>
            <h2 style={{ margin: 0 }}>Быстрый ввод лида</h2>
            <div className="micro">Минимум полей на одной линии, без отдельной длинной формы.</div>
          </div>
        </div>
        <form action={createLead}>
          <div className="compact-form-grid compact-form-grid--leads-top">
            <label>Контакт<input name="contact_name_raw" placeholder="Анна Иванова" required /></label>
            <label>Телефон<input name="phone_raw" placeholder="+7 900 000-00-00" required /></label>
            <label>Email<input name="email_raw" type="email" placeholder="parent@example.com" /></label>
            <label>Страна / интерес<input name="desired_country" placeholder="Китай / язык и технологии" /></label>
            <label>
              Канал
              <select name="source_channel" defaultValue="manual">
                {channelOptions.map((channel) => (
                  <option key={channel} value={channel}>{label('channel', channel)}</option>
                ))}
              </select>
            </label>
            <label className="leads-message-field">Комментарий<textarea name="message" placeholder="Что хочет клиент, на какой сезон, сколько участников" /></label>
          </div>
          <div className="form-actions leads-form-actions"><button className="button">Сохранить лид</button></div>
        </form>
      </article>

      <div className={`deal-workspace ${openLead ? 'is-open' : ''}`}>
        <article className="card stack leads-registry-card">
          <div className="inline-card leads-inline-card">
            <div>
              <h2 style={{ margin: 0 }}>Лента лидов</h2>
              <div className="micro">Статус меняется прямо в строке. «В работе» раскрывает скрипты справа, «Готово» включает оформление сделки без ухода на другую страницу.</div>
            </div>
            <div className="compact-badges">
              <span className="badge">Всего в ленте: {activeLeads.length}</span>
              <span className="badge">Новые: {activeLeads.filter((lead) => lead.status === 'new').length}</span>
              <span className="badge">В работе: {activeLeads.filter((lead) => lead.status === 'in_progress').length}</span>
              {archivedLeadsCount ? <span className="badge">В архиве скрыто: {archivedLeadsCount}</span> : null}
            </div>
          </div>
          <LeadRegistryTable leads={activeLeads} updateStatusAction={updateLeadStatus} />
        </article>

        {openLead ? (
          <aside className="card stack deal-editor-drawer" id="lead-editor">
            <div className="compact-toolbar">
              <div>
                <div className="micro">Боковая панель лида</div>
                <h2 style={{ margin: 0 }}>{openLead.contact_name_raw || 'Без имени'}</h2>
                <div className="micro">Редакция идёт прямо здесь: строка открывает карточку справа, статус управляет следующим шагом.</div>
              </div>
              <div className="compact-badges">
                <span className={`badge ${openLead.converted_deal_id ? '' : 'success'}`}>{openLead.converted_deal_id ? 'В архиве' : label('leadStatus', openLead.status)}</span>
                <span className="badge">{label('channel', openLead.source_channel)}</span>
              </div>
            </div>

            <div className="deal-drawer-meta-grid">
              <div className="card-subtle">
                <div className="micro">Контакт</div>
                <strong>{openLead.phone_raw || 'Телефон не указан'}</strong>
                <div className="micro">{openLead.email_raw || 'Email не указан'}</div>
              </div>
              <div className="card-subtle">
                <div className="micro">Интерес</div>
                <strong>{openLead.desired_program?.title || openLead.desired_country || 'Интерес не указан'}</strong>
                <div className="micro">{openLead.desired_departure?.departure_name || 'Выезд не выбран'}</div>
              </div>
            </div>

            <div className="card-subtle stack">
              <div className="micro">Комментарий и контекст</div>
              <div className="compact-note-list">
                <div><strong>Источник:</strong> <span className="micro-inline">{label('channel', openLead.source_channel)}</span></div>
                <div><strong>Менеджер:</strong> <span className="micro-inline">{openLead.owner?.full_name || 'Не назначен'}</span></div>
                <div><strong>Комментарий:</strong> <span className="micro-inline">{openLead.message || 'Пусто'}</span></div>
                {openLead.converted_deal_id ? <div><strong>Статус лида:</strong> <span className="micro-inline">Архив после создания сделки</span></div> : null}
              </div>
            </div>
            <div className="card-subtle stack">
              <div className="micro">Действия по лиду</div>
              <div className="form-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <Link className="button-secondary" href={`/dashboard/leads/${openLead.id}`}>Редактировать</Link>
                {!openLead.converted_deal_id && openLead.status === 'new' ? (
                  <form action={takeLead}>
                    <input type="hidden" name="lead_id" value={openLead.id} />
                    <button className="button-secondary">Взять в работу</button>
                  </form>
                ) : null}
                {openLead.converted_deal_id ? (
                  <Link className="button-secondary" href={`/dashboard/deals?open=${openLead.converted_deal_id}#deal-editor`}>К сделке</Link>
                ) : null}
              </div>
            </div>


            {openLead.status === 'in_progress' || scriptsMode ? (
              <div className="stack">
                <div className="inline-card">
                  <div>
                    <h3 style={{ margin: 0 }}>Скрипты для работы с лидом</h3>
                    <div className="micro">Панель можно просто оставить справа или свернуть, уйдя на другую строку.</div>
                  </div>
                </div>
                {scripts.length ? scripts.map((script) => (
                  <div key={script.id} className="notice">
                    <div style={{ fontWeight: 700 }}>{script.title}</div>
                    <div className="micro">{script.stage}</div>
                    <div>{script.body}</div>
                  </div>
                )) : <div className="notice">Для этого сегмента пока нет скриптов. Можно добавить их позже в разделе «Скрипты».</div>}
              </div>
            ) : null}

            {(openLead.status === 'qualified' || readyMode) && !openLead.converted_deal_id ? (
              <form action={convertLeadToDeal}>
                <input type="hidden" name="lead_id" value={openLead.id} />
                <input type="hidden" name="title" value={`${openLead.desired_program?.title || openLead.desired_country || 'Программа'} / ${openLead.contact_name_raw || 'Контакт'}`} />
                <input type="hidden" name="stage" value="qualified" />
                <input type="hidden" name="participants_count" value="1" />
                <input type="hidden" name="currency" value="RUB" />
                <input type="hidden" name="notes" value={openLead.message || 'Сделка оформлена из статуса «Готово».'} />
                <div className="notice">
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Лид готов к сделке</div>
                  <div className="micro">Когда контакт доведён до статуса «Готово», здесь появляется прямой переход к оформлению сделки.</div>
                </div>
                <div className="form-actions"><button className="button">Оформить сделку</button></div>
              </form>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  )
}
