import Link from 'next/link'
import { requireDashboardAccess } from '@/lib/auth'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { searchGlobalWorkspace } from '@/lib/queries'
import { WorkbarSearch } from '@/components/workbar-search'

export const dynamic = 'force-dynamic'

function SearchSection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <article className="card stack">
      <div className="section-mini-head">
        <h2>{title}</h2>
        <span className="badge">{count}</span>
      </div>
      {children}
    </article>
  )
}

export default async function DashboardSearchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireDashboardAccess('/dashboard')
  const params = (await searchParams) ?? {}
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  const results = await searchGlobalWorkspace(q, 12)
  const total = results.leads.length + results.deals.length + results.contracts.length + results.applications.length

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Глобальный поиск</h1>
          <p className="muted">Один поиск по лидам, сделкам, договорам и участникам без переключения по разделам.</p>
        </div>
      </section>

      <article className="card stack">
        <WorkbarSearch defaultValue={q} />
        <div className="micro">
          {q ? `Найдено ${total} результатов по запросу «${q}».` : 'Введите имя, телефон, email, номер договора или название сделки.'}
        </div>
      </article>

      {q ? (
        <section className="grid-2 search-results-grid">
          <SearchSection title="Лиды" count={results.leads.length}>
            {results.leads.length ? (
              <div className="workbar-notification-list">
                {results.leads.map((lead) => (
                  <Link key={lead.id} className="workbar-notification-item" href={`/dashboard/leads/${lead.id}`}>
                    <div className="workbar-notification-link">
                      <span>{lead.contact_name_raw || 'Без имени'}</span>
                      <small>{lead.phone_raw || lead.email_raw || lead.desired_country || 'Без контакта'} · {label('leadStatus', lead.status)}</small>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <div className="workbar-notification-empty">Совпадений нет.</div>}
          </SearchSection>

          <SearchSection title="Сделки" count={results.deals.length}>
            {results.deals.length ? (
              <div className="workbar-notification-list">
                {results.deals.map((deal) => (
                  <Link key={deal.id} className="workbar-notification-item" href={`/dashboard/deals?open=${deal.id}#deal-editor`}>
                    <div className="workbar-notification-link">
                      <span>{deal.title}</span>
                      <small>{deal.account?.display_name || deal.lead?.contact_name_raw || 'Без клиента'} · {formatCurrency(deal.estimated_value, deal.currency)} · {label('dealStage', deal.stage)}</small>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <div className="workbar-notification-empty">Совпадений нет.</div>}
          </SearchSection>

          <SearchSection title="Договоры" count={results.contracts.length}>
            {results.contracts.length ? (
              <div className="workbar-notification-list">
                {results.contracts.map((contract) => (
                  <Link key={contract.id} className="workbar-notification-item" href={`/dashboard/contracts/${contract.id}`}>
                    <div className="workbar-notification-link">
                      <span>{contract.contract_number}</span>
                      <small>{contract.application?.participant_name || contract.title} · {label('contractStatus', contract.status)} · {formatDateTime(contract.created_at)}</small>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <div className="workbar-notification-empty">Совпадений нет.</div>}
          </SearchSection>

          <SearchSection title="Заявки" count={results.applications.length}>
            {results.applications.length ? (
              <div className="workbar-notification-list">
                {results.applications.map((application) => (
                  <Link key={application.id} className="workbar-notification-item" href={`/dashboard/applications/${application.id}`}>
                    <div className="workbar-notification-link">
                      <span>{application.participant_name}</span>
                      <small>{application.guardian_name || application.guardian_phone || application.guardian_email || 'Без плательщика'} · {label('applicationStatus', application.status)}</small>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <div className="workbar-notification-empty">Совпадений нет.</div>}
          </SearchSection>
        </section>
      ) : null}
    </div>
  )
}
