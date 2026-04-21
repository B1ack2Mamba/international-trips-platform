import Link from 'next/link'
import { updateLeadStatus } from '@/app/dashboard/leads/actions'
import { LeadRegistryTable } from '@/components/lead-registry-table'
import { LeadWorkspaceDrawer } from '@/components/lead-workspace-drawer'
import { getLeadAssignableProfiles } from '@/lib/lead-access'
import { requireDashboardAccess } from '@/lib/auth'
import { getLeadById, getMyLeads, getSalesScriptsBySegment } from '@/lib/queries'

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
  const readyMode = params.ready === '1'
  const error = typeof params.error === 'string' ? params.error : ''

  const [leads, openLead, assignableProfiles] = await Promise.all([
    getMyLeads(user!.id, 120),
    openLeadId ? getLeadById(openLeadId) : Promise.resolve(null),
    getLeadAssignableProfiles(),
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
              <h2 style={{ margin: 0 }}>Моя очередь</h2>
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
            readyMode={readyMode}
            returnPath="/dashboard/my-leads"
          />
        ) : null}
      </div>
    </div>
  )
}
