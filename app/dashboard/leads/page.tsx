import Link from 'next/link'
import { createLead, updateLeadStatus } from './actions'
import { channelOptions, label } from '@/lib/labels'
import { LeadRegistryTable } from '@/components/lead-registry-table'
import { LeadWorkspaceDrawer } from '@/components/lead-workspace-drawer'
import { getLeadById, getSalesScriptsBySegment, getUnassignedLeads } from '@/lib/queries'
import { getLeadAssignableProfiles } from '@/lib/lead-access'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const openLeadId = typeof params.open === 'string' ? params.open : ''
  const scriptsMode = params.scripts === '1'
  const dealMode = params.deal === '1'

  const [leads, openLead, assignableProfiles] = await Promise.all([
    getUnassignedLeads(80),
    openLeadId ? getLeadById(openLeadId) : Promise.resolve(null),
    getLeadAssignableProfiles(),
  ])
  const scripts = openLead?.desired_program?.segment ? await getSalesScriptsBySegment(openLead.desired_program.segment, 6) : []

  return (
    <div className="content-stack compact-page fullscreen-stretch leads-fullscreen-page">
      <section className="section-head leads-section-head leads-section-head--tight">
        <div>
          <h1 className="page-title">Лиды</h1>
          <p className="muted">Здесь только свободные лиды. Как только менеджер берёт лида в работу, он пропадает из общей ленты и переезжает в раздел «Мои лиды».</p>
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
              <h2 style={{ margin: 0 }}>Свободные лиды</h2>
              <div className="micro">Нажмите строку, чтобы открыть панель справа, или возьмите лида в работу из карточки.</div>
            </div>
            <div className="compact-badges">
              <span className="badge">Свободных: {leads.length}</span>
              <span className="badge">Новые: {leads.filter((lead) => lead.status === 'new').length}</span>
              <Link className="button-secondary" href="/dashboard/my-leads">Мои лиды</Link>
            </div>
          </div>
          <LeadRegistryTable leads={leads} updateStatusAction={updateLeadStatus} statusEditable={false} />
        </article>

        {openLead ? (
          <LeadWorkspaceDrawer
            lead={openLead}
            scripts={scripts}
            assignableProfiles={assignableProfiles}
            scriptsMode={scriptsMode}
            dealMode={dealMode}
            returnPath="/dashboard/leads"
          />
        ) : null}
      </div>
    </div>
  )
}
