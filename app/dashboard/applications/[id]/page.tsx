import Link from 'next/link'
import { ProcessTrail } from '@/components/process-trail'
import { notFound } from 'next/navigation'
import {
  createContractFromApplicationAction,
  createPaymentForApplicationAction,
  rotatePortalAccessAction,
  updateApplicationContextAction,
  updatePortalAuthModeAction,
  seedApplicationChecklistAction,
  updateApplicationDocumentStatusAction,
  updateApplicationStatusAction,
} from '../actions'
import { getSiteUrl } from '@/lib/env'
import { applicationStatusOptions, documentStatusOptions, label, paymentStatusOptions, portalAuthModeOptions, visaStatusOptions } from '@/lib/labels'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import {
  getActivityLog,
  getApplicationById,
  getApplicationDocuments,
  getContractTemplates,
  getContractsByApplication,
  getDepartures,
  getPaymentsByApplication,
} from '@/lib/queries'


function buildDepartureLabel(
  application: NonNullable<Awaited<ReturnType<typeof getApplicationById>>>,
) {
  const departure = application.departure ?? application.deal?.departure
  if (!departure) return 'Не назначен'

  const startDate = 'start_date' in departure ? departure.start_date : null
  return [departure.departure_name, startDate ? formatDate(startDate) : null].filter(Boolean).join(' · ')
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const application = await getApplicationById(id)
  if (!application) notFound()

  const [documents, payments, contracts, templates, activities, departures] = await Promise.all([
    getApplicationDocuments(id, 60),
    getPaymentsByApplication(id, 30),
    getContractsByApplication(id, 20),
    getContractTemplates(20),
    getActivityLog('application', id, 40),
    getDepartures(100),
  ])

  const outstanding = Math.max((application.amount_total ?? 0) - (application.amount_paid ?? 0), 0)
  const programTitle = application.deal?.program?.title || application.departure?.program?.title || 'Не выбрана'
  const portalUrl = `${getSiteUrl()}/portal/${application.portal_access_token}`

  const matchingDepartures = application.deal?.program?.id
    ? departures.filter((departure) => departure.program_id === application.deal?.program?.id || departure.id === application.departure_id)
    : departures

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <div className="micro">Заявка #{application.id.slice(0, 8)}</div>
          <h1 className="page-title">{application.participant_name}</h1>
          <p className="muted">Здесь продажа превращается в документы, договоры, деньги и родительский контур.</p>
        </div>
        <Link className="button-secondary" href="/dashboard/applications">
          Назад к заявкам
        </Link>
      </section>

      <ProcessTrail
        items={[
          { label: 'Лиды', href: '/dashboard/leads' },
          { label: 'Сделки', href: '/dashboard/deals' },
          { label: 'Заявки', href: '/dashboard/applications' },
          { label: 'Договоры', href: '/dashboard/contracts' },
          { label: 'Финансы', href: '/dashboard/finance' },
          { label: 'Операционка', href: '/dashboard/ops' },
        ]}
        current="Заявки"
      />

      <section className="grid-2">
        <article className="card flow-card">
          <h2 className="flow-card-title">Как читается эта заявка в процессе</h2>
          <div className="process-trail">
            <span className="process-trail-item">Сделка</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item active">Заявка</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item">Договор</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item">Платёж</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item">Операционка</span>
          </div>
          <ul className="list">
            <li>Эта карточка создаётся из сделки и закрепляет конкретного участника.</li>
            <li>Отсюда запускаются договоры и платежи. Реестры ниже — это уже следствие.</li>
            <li>Чтобы участник попал в Ops, у заявки должен быть назначен выезд.</li>
          </ul>
          <div className="flow-card-links">
            {application.deal ? <Link className="button-secondary" href={`/dashboard/deals/${application.deal.id}`}>Вернуться к сделке</Link> : null}
            <Link className="button-secondary" href="#create-contract">+ Договор</Link>
            <Link className="button-secondary" href="#create-payment">+ Платёж</Link>
            <Link className="button-secondary" href={`/dashboard/contracts?application_id=${application.id}`}>Договоры заявки</Link>
            <Link className="button-secondary" href={`/dashboard/finance?application_id=${application.id}&create=payment`}>Платежи заявки</Link>
            {application.departure?.id ? <Link className="button-secondary" href={`/dashboard/ops/${application.departure.id}`}>Ops выезда</Link> : null}
          </div>
        </article>

        <article className="card stack">
          <div className="badge-row">
            <span className="badge success">{label('applicationStatus', application.status)}</span>
            <span className="badge">Виза: {application.visa_status ? label('visaStatus', application.visa_status) : '—'}</span>
            <span className="badge">Docs {application.documents_completion_pct}%</span>
          </div>
          <h2 style={{ margin: 0 }}>Контекст заявки</h2>
          <div className="grid-2">
            <div><div className="micro">Программа</div><div>{programTitle}</div></div>
            <div><div className="micro">Выезд</div><div>{buildDepartureLabel(application)}</div></div>
            <div><div className="micro">Родитель / плательщик</div><div>{application.guardian_name || '—'}</div><div className="micro">{application.guardian_phone || application.guardian_email || '—'}</div></div>
            <div><div className="micro">Сделка</div><div>{application.deal ? <Link href={`/dashboard/deals/${application.deal.id}`}>{application.deal.title}</Link> : 'Не привязана'}</div></div>
            <div><div className="micro">Финансы</div><div>{formatCurrency(application.amount_paid)} / {formatCurrency(application.amount_total)}</div><div className="micro">Остаток: {formatCurrency(outstanding)}</div></div>
            <div><div className="micro">Текущий договор</div><div>{application.current_contract_id ? <Link href={`/dashboard/contracts/${application.current_contract_id}`}>Открыть текущую версию</Link> : 'Пока не создан'}</div></div>
            <div><div className="micro">Кабинет родителя</div><div>{application.portal_access_enabled ? 'Активен' : 'Отключён'}</div><div className="micro">Режим: {label('portalAuthMode', application.portal_auth_mode)}</div><div className="micro">Истекает: {formatDateTime(application.portal_access_expires_at)}</div></div>
            <div><div className="micro">Создана</div><div>{formatDateTime(application.created_at)}</div><div className="micro">Последнее открытие портала: {formatDateTime(application.portal_last_opened_at)}</div></div>
          </div>
          <div><div className="micro">Примечания</div><div>{application.notes || '—'}</div></div>
        </article>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Редактировать контекст заявки</h2>
          <form action={updateApplicationContextAction}>
            <input type="hidden" name="application_id" value={application.id} />
            <input type="hidden" name="deal_id" value={application.deal?.id || ''} />
            <div className="form-grid">
              <label>Участник<input name="participant_name" defaultValue={application.participant_name} required /></label>
              <label>Родитель<input name="guardian_name" defaultValue={application.guardian_name || ''} /></label>
              <label>Телефон<input name="guardian_phone" defaultValue={application.guardian_phone || ''} /></label>
              <label>Email<input name="guardian_email" type="email" defaultValue={application.guardian_email || ''} /></label>
              <label>
                Выезд
                <select name="departure_id" defaultValue={application.departure_id || ''}>
                  <option value="">Без выезда</option>
                  {matchingDepartures.map((departure) => <option key={departure.id} value={departure.id}>{departure.departure_name} · {formatDate(departure.start_date)}</option>)}
                </select>
              </label>
              <label>Сумма заявки<input name="amount_total" type="number" min="0" step="1000" defaultValue={application.amount_total ?? ''} /></label>
            </div>
            <label>Примечания<textarea name="notes" defaultValue={application.notes || ''} /></label>
            <div className="form-actions"><button className="button">Сохранить контекст заявки</button></div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Обновить статус заявки</h2>
          <form action={updateApplicationStatusAction}>
            <input type="hidden" name="application_id" value={application.id} />
            <div className="form-grid">
              <label>Статус заявки<select name="status" defaultValue={application.status}>{applicationStatusOptions.map((status) => <option key={status} value={status}>{label('applicationStatus', status)}</option>)}</select></label>
              <label>Статус визы<select name="visa_status" defaultValue={application.visa_status || 'not_started'}>{visaStatusOptions.map((status) => <option key={status} value={status}>{label('visaStatus', status)}</option>)}</select></label>
            </div>
            <label>Комментарий<textarea name="note" placeholder="Что произошло по заявке" /></label>
            <div className="form-actions"><button className="button">Сохранить статус</button></div>
          </form>
        </article>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Кабинет родителя / персональная ссылка</h2>
          <div className="notice">Эта ссылка даёт семье единое окно: статус заявки, документы, платежи и договоры.</div>
          <div><div className="micro">URL кабинета</div><pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{portalUrl}</pre></div>
          <div className="form-actions"><a className="button-secondary" href={portalUrl} target="_blank" rel="noreferrer">Открыть портал семьи</a></div>
          <form action={rotatePortalAccessAction}>
            <input type="hidden" name="application_id" value={application.id} />
            <label>Новая дата истечения ссылки<input name="portal_access_expires_at" type="datetime-local" /></label>
            <div className="form-actions"><button className="button-secondary">Перевыпустить ссылку</button></div>
          </form>
          <form action={updatePortalAuthModeAction}>
            <input type="hidden" name="application_id" value={application.id} />
            <label>Режим доступа к порталу<select name="portal_auth_mode" defaultValue={application.portal_auth_mode}>{portalAuthModeOptions.map((mode) => <option key={mode} value={mode}>{label('portalAuthMode', mode)}</option>)}</select></label>
            <div className="form-actions"><button className="button-secondary">Сохранить режим доступа</button></div>
          </form>
        </article>

        <article id="create-contract" className="card stack">
          <h2 style={{ margin: 0 }}>Создать договор</h2>
          <form action={createContractFromApplicationAction}>
            <input type="hidden" name="application_id" value={application.id} />
            <label>Шаблон договора<select name="template_code" defaultValue="family_standard">{templates.map((template) => <option key={template.id} value={template.code}>{template.title} · {template.code}</option>)}</select></label>
            <label className="inline-checkbox"><input name="mark_ready" type="checkbox" defaultChecked /><span>Сразу перевести договор в статус «Готов к отправке»</span></label>
            <div className="form-actions"><button className="button">Создать договор</button></div>
          </form>
          <div className="micro">Новый договор — это версия по этой заявке. После создания ты сразу попадёшь в карточку договора.</div>
        </article>
      </section>

      <section className="grid-2">
        <article id="create-payment" className="card stack card-focus">
          <h2 style={{ margin: 0 }}>Быстрый платёж из заявки</h2>
          <div className="micro">Это самый прямой путь: заявка → платёж. В финреестр запись тоже попадёт.</div>
          <form action={createPaymentForApplicationAction}>
            <input type="hidden" name="application_id" value={application.id} />
            <div className="form-grid">
              <label>Назначение<input name="label" defaultValue="Предоплата" required /></label>
              <label>Плательщик<input name="payer_name" defaultValue={application.guardian_name || ''} /></label>
              <label>Сумма<input name="amount" type="number" min="0" step="1000" required /></label>
              <label>Срок оплаты<input name="due_date" type="date" /></label>
              <label>
                Статус
                <select name="status" defaultValue="pending">{paymentStatusOptions.map((status) => <option key={status} value={status}>{label('paymentStatus', status)}</option>)}</select>
              </label>
              <label>
                Валюта
                <select name="currency" defaultValue={application.deal?.currency || application.departure?.currency || 'RUB'}>
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CNY">CNY</option>
                </select>
              </label>
            </div>
            <div className="form-actions"><button className="button">Создать платёж</button><Link className="button-secondary" href={`/dashboard/finance?application_id=${application.id}`}>Открыть финреестр</Link></div>
          </form>
        </article>

        <article className="card stack">
          <div className="inline-card">
            <div><h2 style={{ margin: 0 }}>Документы</h2><div className="micro">{documents.length ? 'Чек-лист уже создан' : 'Чек-лист ещё не создан'}</div></div>
            {!documents.length ? <form action={seedApplicationChecklistAction}><input type="hidden" name="application_id" value={application.id} /><button className="button">Создать чек-лист</button></form> : null}
          </div>
          {documents.length ? (
            <div className="table-wrap"><table className="table"><thead><tr><th>Документ</th><th>Состояние</th><th>Обновить</th></tr></thead><tbody>{documents.map((document) => <tr key={document.id}><td><div>{document.title}</div><div className="micro">{document.code}</div><div className="micro">Файл: {document.file_path ? <a href={`/api/dashboard/document-download?document_id=${document.id}`} target="_blank" rel="noreferrer">Открыть</a> : 'ещё не привязан'}</div></td><td><div>{label('documentStatus', document.status)}</div><div className="micro">{document.rejected_reason || document.notes || '—'}</div><div className="micro">Проверил: {document.reviewed_by?.full_name || document.reviewed_by?.email || '—'}</div></td><td><form action={updateApplicationDocumentStatusAction}><input type="hidden" name="application_id" value={application.id} /><input type="hidden" name="document_id" value={document.id} /><div className="stack" style={{ minWidth: 240 }}><select name="status" defaultValue={document.status}>{documentStatusOptions.map((status) => <option key={status} value={status}>{label('documentStatus', status)}</option>)}</select><input name="file_path" placeholder="путь в storage / внешняя ссылка" defaultValue={document.file_path || ''} /><input name="rejected_reason" placeholder="Причина отклонения" defaultValue={document.rejected_reason || ''} /><textarea name="note" placeholder="Комментарий" defaultValue={document.notes || ''} /><button className="button-secondary">Сохранить</button></div></form></td></tr>)}</tbody></table></div>
          ) : <div className="muted">Без чек-листа документы будут жить в хаосе. Создай базовый набор сразу.</div>}
        </article>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Платежи по заявке</h2>
          {payments.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Назначение</th><th>Плательщик</th><th>Сумма</th><th>Срок</th><th>Статус</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.label}</td><td>{payment.payer_name}</td><td>{formatCurrency(payment.amount, payment.currency)}</td><td>{formatDate(payment.due_date)}</td><td>{label('paymentStatus', payment.status)}</td></tr>)}</tbody></table></div> : <div className="muted">По заявке пока нет созданных платежей.</div>}
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Договоры по заявке</h2>
          {contracts.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Договор</th><th>Статус</th><th>Подпись / просмотр</th><th>Действия</th></tr></thead><tbody>{contracts.map((contract) => <tr key={contract.id}><td><div>{contract.title}</div><div className="micro">{contract.contract_number}</div><div className="micro">{formatDateTime(contract.created_at)}</div></td><td>{label('contractStatus', contract.status)}</td><td><div>{contract.signatory_name || '—'}</div><div className="micro">отправлен: {formatDateTime(contract.sent_at)}</div><div className="micro">просмотрен: {formatDateTime(contract.viewed_at)}</div><div className="micro">подписан: {formatDateTime(contract.signed_at)}</div></td><td><div className="stack"><Link href={`/dashboard/contracts/${contract.id}`}>Открыть в CRM</Link><a href={portalUrl} target="_blank" rel="noreferrer">Портал семьи</a></div></td></tr>)}</tbody></table></div> : <div className="muted">Пока нет ни одного договора по этой заявке.</div>}
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>История действий</h2>
        {activities.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Событие</th><th>Комментарий</th><th>Кто</th><th>Когда</th></tr></thead><tbody>{activities.map((activity) => <tr key={activity.id}><td><div>{activity.title}</div><div className="micro">{activity.event_type}</div></td><td>{activity.body || '—'}</td><td>{activity.actor?.full_name || activity.actor?.email || 'система'}</td><td>{formatDateTime(activity.created_at)}</td></tr>)}</tbody></table></div> : <div className="muted">История пока пустая.</div>}
      </article>
    </div>
  )
}
