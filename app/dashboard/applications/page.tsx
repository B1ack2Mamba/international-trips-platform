import Link from 'next/link'
import { ProcessTrail } from '@/components/process-trail'
import { ApplicationRegistryTable } from '@/components/application-registry-table'
import { getApplicationsReadDebug, getDealById } from '@/lib/queries'

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const dealId = typeof params?.deal_id === 'string' ? params.deal_id : null
  const departureId = typeof params?.departure_id === 'string' ? params.departure_id : null
  const created = typeof params?.created === 'string' ? params.created : null
  const from = typeof params?.from === 'string' ? params.from : null
  const error = typeof params?.error === 'string' ? params.error : null
  const mode = typeof params?.mode === 'string' ? params.mode : null

  const readOptions = dealId || departureId
    ? { dealId, departureId, limit: 80 }
    : { dealId, departureId, createdId: created, limit: 80 }

  const [applicationsResult, deal] = await Promise.all([
    getApplicationsReadDebug(readOptions),
    dealId ? getDealById(dealId) : Promise.resolve(null),
  ])

  const applications = applicationsResult.rows
  const readDebug = applicationsResult.debug
  const departureContext = departureId ? applications[0]?.departure ?? null : null

  const contextTitle = deal
    ? `Участники по сделке «${deal.title}»`
    : departureId
      ? 'Участники выбранного выезда'
      : 'Реестр участников'

  const contextText = deal
    ? 'Здесь показываются все участники, которые родились из этой сделки.'
    : departureId
      ? 'Здесь видны все участники конкретного выезда.'
      : 'Плотный реестр участников: без лишней вертикали и длинных пояснений.'

  return (
    <div className="content-stack compact-page fullscreen-stretch applications-fullscreen-page">
      <section className="section-head applications-section-head applications-section-head--tight">
        <div>
          <h1 className="page-title">Участники</h1>
          <p className="muted">{contextText}</p>
        </div>
        <div className="compact-toolbar applications-toolbar">
          {deal ? <Link className="button-secondary" href={`/dashboard/deals?open=${deal.id}#deal-editor`}>К сделке</Link> : null}
          {deal ? <Link className="button-secondary" href={`/dashboard/deals?open=${deal.id}#deal-editor`}>Открыть редактор сделки</Link> : null}
          {(dealId || departureId) ? <Link className="button-secondary" href="/dashboard/participants">Показать всех участников</Link> : null}
        </div>
      </section>

      <ProcessTrail
        items={[
          { label: 'Лиды', href: '/dashboard/leads' },
          { label: 'Сделки', href: '/dashboard/deals' },
          { label: 'Участники', href: '/dashboard/participants' },
          { label: 'Договоры', href: '/dashboard/contracts' },
          { label: 'Финансы', href: '/dashboard/finance' },
          { label: 'Операционка', href: '/dashboard/ops' },
        ]}
        current="Участники"
      />

      {error ? (
        <div className="notice notice-danger">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Не удалось передать сделку в участников</div>
          <div className="micro">{error}</div>
        </div>
      ) : null}

      {created && from === 'deal' ? (
        <div className="notice">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Переход из сделки выполнен</div>
          <div className="micro">Режим: {mode || 'user-rpc'}. Ниже показываются все участники контекста, а не только последняя запись.</div>
        </div>
      ) : null}

      {readDebug.source === 'failed' ? (
        <div className="notice notice-danger">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Реестр участников не удалось прочитать</div>
          <div className="micro">{readDebug.error || 'Supabase не вернул детали ошибки'}.</div>
          {readDebug.attempts.length ? (
            <div className="micro" style={{ marginTop: 8 }}>Попытки: {readDebug.attempts.join(' • ')}</div>
          ) : null}
        </div>
      ) : null}

      <section className="kpi-grid kpi-grid--compact applications-kpi-grid">
        <div className="card kpi"><div className="kpi-label">Всего в реестре</div><div className="kpi-value">{applications.length}</div><div className="micro">Видимые участники</div></div>
        <div className="card kpi"><div className="kpi-label">Подписан договор</div><div className="kpi-value">{applications.filter((item) => item.contract_status === 'signed').length}</div><div className="micro">По текущему списку</div></div>
        <div className="card kpi"><div className="kpi-label">Оплачено полностью</div><div className="kpi-value">{applications.filter((item) => item.payment_status === 'paid').length}</div><div className="micro">Статус оплаты</div></div>
      </section>

      <article className="card stack applications-registry-card">
        <div className="inline-card applications-inline-card">
          <div>
            <h2 style={{ margin: 0 }}>{contextTitle}</h2>
            <div className="micro">Контакт, сделка, выезд, документы и деньги должны читаться в одной строке.</div>
          </div>
          <div className="compact-badges">
            {deal ? <span className="badge">Сделка: {deal.title}</span> : null}
            {departureContext?.departure_name ? <span className="badge">Выезд: {departureContext.departure_name}</span> : null}
            <span className="badge">Источник: {readDebug.source}</span>
          </div>
        </div>
        {!applications.length ? (
          <div className="empty-state" style={{ margin: '8px 0' }}>
            {created && from === 'deal'
              ? 'После передачи из сделки здесь должен появиться полный список участников этой сделки. Если пусто, смотри notice выше.'
              : 'Пока участников не видно.'}
          </div>
        ) : null}
        {applications.length ? <ApplicationRegistryTable applications={applications} /> : null}
      </article>
    </div>
  )
}
