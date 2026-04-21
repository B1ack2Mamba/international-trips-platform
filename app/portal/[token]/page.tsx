import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { getPortalSnapshotByToken } from '@/lib/queries'
import { PortalDocumentUploader } from '@/components/portal-document-uploader'
import { hasPortalTokenAccess } from '@/lib/portal-auth'

export default async function PortalHomePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const access = await hasPortalTokenAccess(token)
  if (!access.ok) {
    if (access.error === 'otp_required') {
      redirect(`/portal/access/${token}`)
    }
    notFound()
  }

  const snapshot = await getPortalSnapshotByToken(token)
  if (!snapshot) notFound()

  const { application, documents, payments, contracts } = snapshot
  const departure = application.departure ?? application.deal?.departure
  const program = application.departure?.program ?? application.deal?.program
  const programLocation = application.departure?.program
    ? [application.departure.program.country, application.departure.program.city].filter(Boolean).join(', ')
    : '—'
  const outstanding = Math.max((application.amount_total ?? 0) - (application.amount_paid ?? 0), 0)
  const departureEndDate = departure && typeof departure === 'object' && 'end_date' in departure
    ? (departure.end_date as string | null | undefined)
    : undefined
  const departureDateRange = departure
    ? `${formatDate(departure.start_date ?? null)} — ${formatDate(departureEndDate ?? null)}`
    : '—'

  return (
    <main className="container section">
      <section className="section-head">
        <div>
          <div className="micro">Кабинет семьи</div>
          <h1 className="page-title">{application.participant_name}</h1>
          <p className="muted">
            Единое окно для семьи: статус заявки, договоры, документы и платежи без ручного
            блуждания по чатам.
          </p>
        </div>
        {application.portal_auth_mode === 'otp_required' ? (
          <Link className="button-secondary" href={`/portal/access/${token}`}>
            Управление доступом
          </Link>
        ) : null}
      </section>

      <section className="grid-2">
        <article className="card stack">
          <div className="badge-row">
            <span className="badge success">{label('applicationStatus', application.status)}</span>
            <span className="badge">Документы {application.documents_completion_pct}%</span>
            <span className="badge">Виза: {label('visaStatus', application.visa_status)}</span>
          </div>
          <h2 style={{ margin: 0 }}>Статус поездки</h2>
          <div className="grid-2">
            <div><div className="micro">Программа</div><div>{program?.title || 'Будет уточнена'}</div></div>
            <div><div className="micro">Локация</div><div>{programLocation}</div></div>
            <div><div className="micro">Выезд</div><div>{departure?.departure_name || 'Будет уточнён'}</div><div className="micro">{departureDateRange}</div></div>
            <div><div className="micro">Родитель / плательщик</div><div>{application.guardian_name || '—'}</div><div className="micro">{application.guardian_phone || application.guardian_email || '—'}</div></div>
            <div><div className="micro">Оплачено</div><div>{formatCurrency(application.amount_paid)}</div></div>
            <div><div className="micro">Остаток</div><div>{formatCurrency(outstanding)}</div></div>
          </div>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Что сейчас важно</h2>
          <div className="notice">Здесь у родителя должна быть простая картина: что уже закрыто, что ещё нужно прислать и что оплачивать дальше.</div>
          <div className="stack">
            <div><div className="micro">Последнее открытие кабинета</div><div>{formatDateTime(application.portal_last_opened_at)}</div></div>
            <div><div className="micro">Количество договоров</div><div>{contracts.length}</div></div>
            <div><div className="micro">Количество документов</div><div>{documents.length}</div></div>
            <div><div className="micro">Количество платежей</div><div>{payments.length}</div></div>
          </div>
        </article>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Договоры</h2>
          {contracts.length ? (
            <div className="table-wrap"><table className="table"><thead><tr><th>Документ</th><th>Статус</th><th>Создан</th><th>Открыть</th></tr></thead><tbody>{contracts.map((contract) => <tr key={contract.id}><td><div>{contract.title}</div><div className="micro">{contract.contract_number}</div></td><td>{label('contractStatus', contract.status)}</td><td>{formatDateTime(contract.created_at)}</td><td><Link href={`/portal/${token}/contracts/${contract.id}`}>Открыть договор</Link></td></tr>)}</tbody></table></div>
          ) : (
            <div className="muted">Организатор ещё не сформировал договор в системе.</div>
          )}
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Платежи</h2>
          {payments.length ? (
            <div className="table-wrap"><table className="table"><thead><tr><th>Назначение</th><th>Сумма</th><th>Срок</th><th>Статус</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.label}</td><td>{formatCurrency(payment.amount, payment.currency)}</td><td>{formatDate(payment.due_date)}</td><td>{label('paymentStatus', payment.status)}</td></tr>)}</tbody></table></div>
          ) : (
            <div className="muted">Платежи ещё не зафиксированы в системе.</div>
          )}
        </article>
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Документы</h2>
        <div className="notice">Здесь семья может сама загружать документы в систему. Менеджер увидит файл в CRM и переведёт его в проверенный или отклонённый статус.</div>
        {documents.length ? <PortalDocumentUploader token={token} documents={documents} /> : <div className="muted">Чек-лист документов будет добавлен менеджером после оформления заявки.</div>}
      </section>
    </main>
  )
}
