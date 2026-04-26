import Link from 'next/link'
import { createContractForDealAction } from './actions'
import { ProcessTrail } from '@/components/process-trail'
import { formatDateTime } from '@/lib/format'
import { getApplicationById, getContracts, getContractsByApplication, getContractsByDeal, getContractTemplates, getDealById } from '@/lib/queries'
import { label } from '@/lib/labels'

export default async function ContractsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const applicationId = typeof params?.application_id === 'string' ? params.application_id : null
  const dealId = typeof params?.deal_id === 'string' ? params.deal_id : null
  const error = typeof params?.error === 'string' ? params.error : ''

  const application = applicationId ? await getApplicationById(applicationId) : null
  const linkedDealId = dealId || application?.deal?.id || application?.deal_id || null

  const [contracts, deal, templates] = await Promise.all([
    applicationId ? getContractsByApplication(applicationId, 60) : linkedDealId ? getContractsByDeal(linkedDealId, 60) : getContracts(60),
    linkedDealId ? getDealById(linkedDealId) : Promise.resolve(null),
    getContractTemplates(50),
  ])

  const contextTitle = application
    ? `Договоры по заявке ${application.participant_name}`
    : deal
      ? `Договоры по сделке ${deal.title}`
      : 'Реестр договоров'

  const contextText = application
    ? 'Это договорные версии одной конкретной заявки.'
    : deal
      ? 'Это договоры, привязанные к выбранной сделке.'
      : 'Здесь собираются все договоры системы.'

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Договоры</h1>
          <p className="muted">После сделки следующий шаг — договор. Договор создаётся в нужном формате и привязывается к сделке.</p>
        </div>
        <div className="form-actions">
          {deal ? <Link className="button-secondary" href={`/dashboard/deals?open=${deal.id}#deal-editor`}>К сделке</Link> : null}
          {(applicationId || linkedDealId) ? <Link className="button-secondary" href="/dashboard/contracts">Показать все договоры</Link> : null}
        </div>
      </section>

      <ProcessTrail
        items={[
          { label: 'Лиды', href: '/dashboard/leads' },
          { label: 'Сделки', href: '/dashboard/deals' },
          { label: 'Договоры', href: '/dashboard/contracts' },
          { label: 'Участники', href: '/dashboard/participants' },
        ]}
        current="Договоры"
      />

      {error ? <div className="notice notice-danger">{error}</div> : null}

      <section className="grid-2">
        {deal ? (
          <article className="card stack">
            <h2 style={{ margin: 0 }}>Добавить договор к сделке</h2>
            <div className="micro">Выберите формат договора. Он будет создан и закреплён за сделкой.</div>
            <form action={createContractForDealAction}>
              <input type="hidden" name="deal_id" value={deal.id} />
              <div className="form-grid">
                <label>
                  Формат договора
                  <select name="template_code" defaultValue={templates[0]?.code || 'family_standard'}>
                    {templates.map((template) => (
                      <option key={template.id} value={template.code}>{template.title}</option>
                    ))}
                  </select>
                </label>
                <label className="inline-checkbox"><input name="mark_ready" type="checkbox" defaultChecked /><span>Сразу готов к отправке</span></label>
              </div>
              <div className="form-actions"><button className="button">Создать договор</button></div>
            </form>
          </article>
        ) : (
          <article className="card flow-card">
            <h2 className="flow-card-title">Как договоры появляются в системе</h2>
            <div className="process-trail">
              <span className="process-trail-item">Сделка</span>
              <span className="process-trail-arrow">→</span>
              <span className="process-trail-item active">Договор</span>
              <span className="process-trail-arrow">→</span>
              <span className="process-trail-item">Оплата в сделке</span>
              <span className="process-trail-arrow">→</span>
              <span className="process-trail-item">Участники</span>
            </div>
            <ul className="list">
              <li>Договор создаётся из сделки и привязывается к ней.</li>
              <li>Можно выбрать формат договора через шаблон.</li>
              <li>После полной оплаты клиент переводится в участников выезда.</li>
            </ul>
          </article>
        )}
        <article className="card stack">
          <h2 style={{ margin: 0 }}>{contextTitle}</h2>
          <div className="micro">{contextText}</div>
          <div className="flow-card-links">
            {deal ? <Link className="button-secondary" href={`/dashboard/deals?open=${deal.id}&pay=1#deal-payment-popover`}>Оплата в сделке</Link> : null}
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
                <th>Сделка</th>
                <th>Статус</th>
                <th>Подписант</th>
                <th>Действия</th>
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
                    <div>{contract.deal ? <Link href={`/dashboard/deals?open=${contract.deal.id}#deal-editor`}>{contract.deal.title}</Link> : contract.account?.display_name || '—'}</div>
                    <div className="micro">{contract.application?.participant_name || 'техническая запись участника будет создана автоматически'}</div>
                  </td>
                  <td>{label('contractStatus', contract.status)}</td>
                  <td><div>{contract.signatory_name || contract.application?.guardian_name || '—'}</div><div className="micro">{contract.signatory_email || contract.application?.guardian_email || '—'}</div></td>
                  <td>
                    <div className="flow-card-links">
                      {contract.deal ? <Link className="button-secondary" href={`/dashboard/deals?open=${contract.deal.id}&pay=1#deal-payment-popover`}>Оплата</Link> : null}
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
