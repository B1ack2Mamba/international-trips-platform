import Link from 'next/link'
import { ProcessTrail } from '@/components/process-trail'
import { formatDateTime } from '@/lib/format'
import { getApplicationById, getContracts, getContractsByApplication, getContractsByDeal, getDealById } from '@/lib/queries'
import { label } from '@/lib/labels'

export default async function ContractsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const applicationId = typeof params?.application_id === 'string' ? params.application_id : null
  const dealId = typeof params?.deal_id === 'string' ? params.deal_id : null

  const application = applicationId ? await getApplicationById(applicationId) : null
  const linkedDealId = dealId || application?.deal?.id || application?.deal_id || null

  const [contracts, deal] = await Promise.all([
    applicationId ? getContractsByApplication(applicationId, 60) : linkedDealId ? getContractsByDeal(linkedDealId, 60) : getContracts(60),
    linkedDealId ? getDealById(linkedDealId) : Promise.resolve(null),
  ])

  const contextTitle = application
    ? `Договоры по заявке ${application.participant_name}`
    : deal
      ? `Договоры по сделке ${deal.title}`
      : 'Реестр договоров'

  const contextText = application
    ? 'Это договорные версии одной конкретной заявки.'
    : deal
      ? 'Это все договоры, родившиеся из выбранной сделки и её заявок.'
      : 'Здесь собираются все договоры системы.'

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Договоры</h1>
          <p className="muted">Договор должен жить не отдельно в Word, а как продолжение конкретной заявки и сделки.</p>
        </div>
        <div className="form-actions">
          {deal ? <Link className="button-secondary" href={`/dashboard/deals/${deal.id}`}>К сделке</Link> : null}
          {application ? <Link className="button-secondary" href={`/dashboard/applications/${application.id}`}>К заявке</Link> : null}
          {(applicationId || linkedDealId) ? <Link className="button-secondary" href="/dashboard/contracts">Показать все договоры</Link> : null}
        </div>
      </section>

      <ProcessTrail
        items={[
          { label: 'Лиды', href: '/dashboard/leads' },
          { label: 'Сделки', href: '/dashboard/deals' },
          { label: 'Заявки', href: '/dashboard/applications' },
          { label: 'Договоры', href: '/dashboard/contracts' },
          { label: 'Финансы', href: '/dashboard/finance' },
        ]}
        current="Договоры"
      />

      <section className="grid-2">
        <article className="card flow-card">
          <h2 className="flow-card-title">Как договоры появляются в системе</h2>
          <div className="process-trail">
            <span className="process-trail-item">Сделка</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item">Заявка</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item active">Договор</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item">Финансы</span>
          </div>
          <ul className="list">
            <li>Договор создаётся из карточки заявки, а не сам по себе из реестра.</li>
            <li>У одной сделки может быть несколько заявок и несколько договоров.</li>
            <li>После создания договор можно открыть семье и дальше вести его до отправки, просмотра и подписи.</li>
          </ul>
          <div className="flow-card-links">
            <Link className="button-secondary" href="/dashboard/applications">Открыть заявки</Link>
            {application ? <Link className="button-secondary" href={`/dashboard/applications/${application.id}#create-contract`}>+ Договор в заявке</Link> : null}
            {application ? <Link className="button-secondary" href={`/dashboard/applications/${application.id}#create-payment`}>+ Платёж к договору</Link> : null}
            <Link className="button-secondary" href="/dashboard/finance?create=payment">Открыть финансы</Link>
          </div>
        </article>
        <article className="card stack">
          <h2 style={{ margin: 0 }}>{contextTitle}</h2>
          <div className="micro">{contextText}</div>
          <div className="flow-card-links">
            {application ? <Link className="button-secondary" href={`/dashboard/applications/${application.id}`}>Карточка заявки</Link> : null}
            {application ? <Link className="button-secondary" href={`/dashboard/finance?application_id=${application.id}&create=payment`}>Платежи заявки</Link> : null}
            {deal ? <Link className="button-secondary" href={`/dashboard/finance?deal_id=${deal.id}&create=payment`}>Платежи сделки</Link> : null}
            {application?.departure?.id ? <Link className="button-secondary" href={`/dashboard/departures/${application.departure.id}`}>Карточка выезда</Link> : null}
          </div>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Реестр договоров</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Договор</th>
                <th>Откуда пришёл</th>
                <th>Статус</th>
                <th>Подписант</th>
                <th>Следующий блок</th>
                <th>События</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    <div><Link href={`/dashboard/contracts/${contract.id}`}>{contract.title}</Link></div>
                    <div className="micro">{contract.contract_number}</div>
                  </td>
                  <td>
                    {contract.application ? <div><Link href={`/dashboard/applications/${contract.application.id}`}>{contract.application.participant_name}</Link></div> : '—'}
                    <div className="micro">{contract.deal ? <Link href={`/dashboard/deals/${contract.deal.id}`}>{contract.deal.title}</Link> : contract.account?.display_name || '—'}</div>
                  </td>
                  <td>{label('contractStatus', contract.status)}</td>
                  <td><div>{contract.signatory_name || contract.application?.guardian_name || '—'}</div><div className="micro">{contract.signatory_email || contract.application?.guardian_email || '—'}</div></td>
                  <td>
                    <div className="flow-card-links">
                      {contract.application ? <Link className="button-secondary" href={`/dashboard/finance?application_id=${contract.application.id}`}>Платежи</Link> : null}
                      {contract.deal ? <Link className="button-secondary" href={`/dashboard/finance?deal_id=${contract.deal.id}`}>Сделка → деньги</Link> : null}
                      <Link className="button-secondary" href={`/dashboard/contracts/${contract.id}`}>Открыть</Link>
                    </div>
                  </td>
                  <td>
                    <div className="micro">Создан: {formatDateTime(contract.created_at)}</div>
                    <div className="micro">Sent: {formatDateTime(contract.sent_at)}</div>
                    <div className="micro">Viewed: {formatDateTime(contract.viewed_at)}</div>
                    <div className="micro">Signed: {formatDateTime(contract.signed_at)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
