import Link from 'next/link'
import { updateLeadStatus } from '@/app/dashboard/leads/actions'
import { LeadRegistryTable } from '@/components/lead-registry-table'
import { LeadWorkspaceDrawer } from '@/components/lead-workspace-drawer'
import { getLeadAssignableProfiles } from '@/lib/lead-access'
import { requireDashboardAccess } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { getActivityLog, getLeadById, getMyLeads, getSalesScriptsBySegment } from '@/lib/queries'

export const dynamic = 'force-dynamic'

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
  const error = typeof params.error === 'string' ? params.error : ''

  const [leads, openLead, assignableProfiles, activities] = await Promise.all([
    getMyLeads(user!.id, 120),
    openLeadId ? getLeadById(openLeadId) : Promise.resolve(null),
    getLeadAssignableProfiles(),
    openLeadId ? getActivityLog('lead', openLeadId, 30) : Promise.resolve([]),
  ])
  const scripts = openLead?.desired_program?.segment ? await getSalesScriptsBySegment(openLead.desired_program.segment, 6) : []

  return (
    <div className="content-stack compact-page fullscreen-stretch leads-fullscreen-page">
      <section className="section-head leads-section-head leads-section-head--tight">
        <div>
          <h1 className="page-title">Мои лиды</h1>
          <p className="muted">Персональная очередь: здесь остаются лиды, которые вы взяли в работу или получили от коллег.</p>
        </div>
        <div className="form-actions">
          <Link className="button-secondary" href="/dashboard/leads">Свободные лиды</Link>
        </div>
      </section>

      {error ? <div className="notice notice-danger">{error}</div> : null}

      <div className={`deal-workspace ${openLead ? 'is-open' : ''}`}>
        <article className="card stack leads-registry-card">
          <div className="inline-card leads-inline-card">
            <div>
              <h2 style={{ margin: 0 }}>Мои клиенты</h2>
              <div className="micro">Открывайте строку справа, меняйте статус, передавайте лида или оформляйте сделку.</div>
            </div>
            <div className="compact-badges">
              <span className="badge">Всего: {leads.length}</span>
              <span className="badge">Взято в работу: {leads.length}</span>
            </div>
          </div>
          <LeadRegistryTable leads={leads} updateStatusAction={updateLeadStatus} openBasePath="/dashboard/my-leads" statusEditable={false} />
        </article>

        {openLead ? (
          <LeadWorkspaceDrawer
            lead={openLead}
            scripts={scripts}
            assignableProfiles={assignableProfiles}
            scriptsMode={scriptsMode}
            dealMode={dealMode}
            returnPath="/dashboard/my-leads"
          />
        ) : null}
      </div>

      <article className="card stack">
        <div>
          <h2 style={{ margin: 0 }}>История действий</h2>
          <div className="micro">{openLead ? `Лид: ${openLead.contact_name_raw || 'Без имени'}` : 'Откройте клиента из списка, чтобы увидеть историю.'}</div>
        </div>
        {openLead ? (
          activities.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Событие</th><th>Комментарий</th><th>Кто</th><th>Когда</th></tr></thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id}>
                      <td><div>{activity.title}</div><div className="micro">{activity.event_type}</div></td>
                      <td>{activity.body || '—'}</td>
                      <td>{activity.actor?.full_name || activity.actor?.email || 'система'}</td>
                      <td>{formatDateTime(activity.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="muted">История пока пустая.</div>
        ) : <div className="muted">История появится здесь после выбора клиента.</div>}
      </article>
    </div>
  )
}
