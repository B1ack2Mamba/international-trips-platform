import Link from 'next/link'
import { ProcessTrail } from '@/components/process-trail'
import { notFound } from 'next/navigation'
import { createApplicationFromDealAction, updateDealContextAction, updateDealStage } from '../actions'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import {
  getAccounts,
  getActivityLog,
  getApplicationsByDeal,
  getContractsByDeal,
  getDealById,
  getDepartures,
  getPartnerAccounts,
  getPaymentsByDeal,
  getPrograms,
  getSalesScriptsBySegment,
} from '@/lib/queries'

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = await getDealById(id)
  if (!deal) notFound()

  const [activities, payments, scripts, accounts, programs, departures, partnerAccounts, applications, contracts] = await Promise.all([
    getActivityLog('deal', id, 20),
    getPaymentsByDeal(id, 20),
    deal.program?.segment ? getSalesScriptsBySegment(deal.program.segment, 6) : Promise.resolve([]),
    getAccounts(100),
    getPrograms(100),
    getDepartures(100),
    getPartnerAccounts(100),
    getApplicationsByDeal(id, 30),
    getContractsByDeal(id, 20),
  ])

  const matchingDepartures = deal.program_id
    ? departures.filter((departure) => departure.program_id === deal.program_id || departure.id === deal.departure_id)
    : departures

  const totalPaid = payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <div className="micro">Сделка #{deal.id.slice(0, 8)}</div>
          <h1 className="page-title">{deal.title}</h1>
          <p className="muted">Это центральный узел процесса: от него должны корректно расходиться заявки, договоры, платежи и выезд.</p>
        </div>
        <div className="form-actions">
          <Link className="button-secondary" href="/dashboard/deals">Назад к сделкам</Link>
          <Link className="button-secondary" href={`/dashboard/finance?deal_id=${deal.id}`}>Платежи сделки</Link>
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
        current="Сделки"
      />

      <section className="grid-2">
        <article className="card flow-card">
          <h2 className="flow-card-title">Как эта сделка связана с остальным</h2>
          <div className="process-trail">
            <span className="process-trail-item">Лид</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item active">Сделка</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item">Участники</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item">Договоры</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item">Платежи</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item">Операционка</span>
          </div>
          <ul className="list">
            <li>Сделка должна знать аккаунт, программу, выезд и партнёра — иначе дальше всё рвётся.</li>
            <li>Заявка создаётся из сделки и копирует её выезд. Если выезд не назначен, участник не попадёт в Ops.</li>
            <li>Договоры и платежи тестируй уже по заявке, но видеть их по сделке тоже можно отсюда.</li>
          </ul>
          <div className="flow-card-links">
            {deal.lead_id ? <Link className="button-secondary" href={`/dashboard/leads/${deal.lead_id}`}>Источник: лид</Link> : null}
            <Link className="button-secondary" href={`/dashboard/participants?deal_id=${deal.id}`}>Участники сделки</Link>
            <Link className="button-secondary" href={`/dashboard/contracts?deal_id=${deal.id}`}>Договоры сделки</Link>
            <Link className="button-secondary" href={`/dashboard/finance?deal_id=${deal.id}&create=payment`}>+ Платёж по сделке</Link>
          </div>
        </article>

        <article className="card stack">
          <div className="badge-row">
            <span className="badge success">{label('dealStage', deal.stage)}</span>
            <span className="badge">{deal.currency}</span>
            {deal.program?.segment ? <span className="badge">{label('segment', deal.program.segment)}</span> : null}
          </div>
          <h2 style={{ margin: 0 }}>Контекст сделки</h2>
          <div className="grid-2">
            <div><div className="micro">Сумма</div><div>{formatCurrency(deal.estimated_value, deal.currency)}</div></div>
            <div><div className="micro">Участников</div><div>{deal.participants_count}</div></div>
            <div><div className="micro">Аккаунт</div><div>{deal.account?.display_name || 'Не привязан'}</div></div>
            <div><div className="micro">Лид</div><div>{deal.lead?.contact_name_raw || 'Не привязан'}</div></div>
            <div><div className="micro">Программа</div><div>{deal.program?.title || 'Не выбрана'}</div></div>
            <div><div className="micro">Выезд</div><div>{deal.departure?.departure_name || 'Не выбран'}</div></div>
            <div><div className="micro">Партнёр</div><div>{deal.partner?.display_name || '—'}</div></div>
            <div><div className="micro">План закрытия</div><div>{formatDate(deal.close_date)}</div></div>
            <div><div className="micro">Оплачено по сделке</div><div>{formatCurrency(totalPaid, deal.currency)}</div></div>
            <div><div className="micro">Создана</div><div>{formatDateTime(deal.created_at)}</div></div>
          </div>
          <div><div className="micro">Примечания</div><div>{deal.notes || '—'}</div></div>
        </article>
      </section>

      <section className="grid-2">
        <article id="edit-deal-context" className="card stack">
          <h2 style={{ margin: 0 }}>Редактировать связи сделки</h2>
          <form action={updateDealContextAction}>
            <input type="hidden" name="deal_id" value={deal.id} />
            <div className="form-grid">
              <label>Название сделки<input name="title" defaultValue={deal.title} required /></label>
              <label>
                Аккаунт
                <select name="account_id" defaultValue={deal.account_id || ''}>
                  <option value="">Без аккаунта</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.display_name} · {label('accountType', account.account_type)}</option>)}
                </select>
              </label>
              <label>
                Программа
                <select name="program_id" defaultValue={deal.program_id || ''}>
                  <option value="">Без программы</option>
                  {programs.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}
                </select>
              </label>
              <label>
                Выезд
                <select name="departure_id" defaultValue={deal.departure_id || ''}>
                  <option value="">Без выезда</option>
                  {matchingDepartures.map((departure) => <option key={departure.id} value={departure.id}>{departure.departure_name} · {formatDate(departure.start_date)}</option>)}
                </select>
              </label>
              <label>
                Партнёр
                <select name="partner_account_id" defaultValue={deal.partner_account_id || ''}>
                  <option value="">Без партнёра</option>
                  {partnerAccounts.map((account) => <option key={account.id} value={account.id}>{account.display_name}</option>)}
                </select>
              </label>
              <label>Сумма<input name="estimated_value" type="number" min="0" step="1000" defaultValue={deal.estimated_value ?? ''} /></label>
              <label>
                Валюта
                <select name="currency" defaultValue={deal.currency || 'RUB'}>
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CNY">CNY</option>
                </select>
              </label>
              <label>Участников<input name="participants_count" type="number" min="1" defaultValue={deal.participants_count} /></label>
              <label>План закрытия<input name="close_date" type="date" defaultValue={deal.close_date || ''} /></label>
            </div>
            <label>Примечания<textarea name="notes" defaultValue={deal.notes || ''} /></label>
            <div className="form-actions"><button className="button">Сохранить связи сделки</button></div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Стадия сделки</h2>
          <form action={updateDealStage}>
            <input type="hidden" name="deal_id" value={deal.id} />
            <div className="form-grid">
              <label>
                Стадия
                <select name="stage" defaultValue={deal.stage}>
                  <option value="qualified">Квалифицирована</option>
                  <option value="proposal">Предложение</option>
                  <option value="negotiation">Переговоры</option>
                  <option value="won">Выиграна</option>
                  <option value="lost">Потеряна</option>
                </select>
              </label>
            </div>
            <label>Комментарий<textarea name="note" placeholder="Что изменилось по сделке" /></label>
            <div className="form-actions"><button className="button">Сохранить стадию</button></div>
          </form>
        </article>
      </section>

      <section className="grid-2">
        <article id="create-application" className="card stack">
          <h2 style={{ margin: 0 }}>Создать заявку участника</h2>
          <form action={createApplicationFromDealAction}>
            <input type="hidden" name="deal_id" value={deal.id} />
            <div className="form-grid">
              <label>Имя участника<input name="participant_name" placeholder="Иван Иванов" required /></label>
              <label>Имя родителя / плательщика<input name="guardian_name" defaultValue={deal.lead?.contact_name_raw || ''} /></label>
              <label>Телефон родителя<input name="guardian_phone" defaultValue={deal.lead?.phone_raw || ''} /></label>
              <label>Email родителя<input name="guardian_email" type="email" defaultValue={deal.lead?.email_raw || ''} /></label>
              <label>Общая сумма заявки<input name="amount_total" type="number" min="0" step="1000" defaultValue={deal.estimated_value ? String(deal.estimated_value) : ''} /></label>
              <label>Сумма первого платежа<input name="payment_amount" type="number" min="0" step="1000" /></label>
              <label>Срок оплаты<input name="due_date" type="date" /></label>
              <label>Назначение платежа<input name="payment_label" defaultValue="Предоплата" /></label>
            </div>
            <label className="inline-checkbox"><input name="create_payment" type="checkbox" defaultChecked /><span>Создать первый платёж автоматически</span></label>
            <div className="form-actions"><button className="button">Создать заявку</button></div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Скрипты и подсказки</h2>
          {scripts.length ? scripts.map((script) => <div key={script.id} className="notice"><div style={{ fontWeight: 700 }}>{script.title}</div><div className="micro">{script.stage}</div><div>{script.body}</div></div>) : <div className="muted">Для сегмента сделки ещё нет скриптов.</div>}
        </article>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <div className="inline-card">
            <div>
              <h2 style={{ margin: 0 }}>Связанные заявки</h2>
              <div className="micro">Именно отсюда рождаются договоры, финансы и попадание в выезд.</div>
            </div>
            <Link className="button-secondary" href={`/dashboard/participants?deal_id=${deal.id}`}>Весь реестр по сделке</Link>
          </div>
          {applications.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Участник</th>
                    <th>Выезд</th>
                    <th>Финансы</th>
                    <th>Дальше</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application.id}>
                      <td>
                        <div><Link href={`/dashboard/participants/${application.id}`}>{application.participant_name}</Link></div>
                        <div className="micro">{application.guardian_name || '—'}</div>
                      </td>
                      <td>{application.departure?.id ? <Link href={`/dashboard/departures/${application.departure.id}`}>{application.departure.departure_name}</Link> : 'Не назначен'}</td>
                      <td>{formatCurrency(application.amount_paid)} / {formatCurrency(application.amount_total)}</td>
                      <td>
                        <div className="flow-card-links">
                          <Link className="button-secondary" href={`/dashboard/contracts?application_id=${application.id}`}>Договоры</Link>
                          <Link className="button-secondary" href={`/dashboard/finance?application_id=${application.id}`}>Платежи</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="muted">По сделке ещё нет ни одной заявки.</div>}
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Договоры и платежи сделки</h2>
          <div className="flow-card-links">
            <Link className="button-secondary" href={`/dashboard/contracts?deal_id=${deal.id}`}>Договоры сделки</Link>
            <Link className="button-secondary" href={`/dashboard/finance?deal_id=${deal.id}`}>Платежи сделки</Link>
            {deal.departure_id ? <Link className="button-secondary" href={`/dashboard/ops/${deal.departure_id}`}>Ops выезда</Link> : null}
          </div>
          {contracts.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Договор</th>
                    <th>Участник</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((contract) => (
                    <tr key={contract.id}>
                      <td><Link href={`/dashboard/contracts/${contract.id}`}>{contract.title}</Link></td>
                      <td>{contract.application?.participant_name || '—'}</td>
                      <td>{label('contractStatus', contract.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="muted">По сделке пока нет договоров.</div>}
          {payments.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Плательщик</th>
                    <th>Назначение</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.payer_name}</td>
                      <td><div>{payment.label}</div><div className="micro">{payment.application?.participant_name || 'Без участника'}</div></td>
                      <td>{formatCurrency(payment.amount, payment.currency)}</td>
                      <td>{label('paymentStatus', payment.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>История действий</h2>
        {activities.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Событие</th><th>Комментарий</th><th>Кто</th><th>Когда</th></tr></thead><tbody>{activities.map((activity) => <tr key={activity.id}><td><div>{activity.title}</div><div className="micro">{activity.event_type}</div></td><td>{activity.body || '—'}</td><td>{activity.actor?.full_name || activity.actor?.email || 'система'}</td><td>{formatDateTime(activity.created_at)}</td></tr>)}</tbody></table></div> : <div className="muted">История пока пустая.</div>}
      </article>
    </div>
  )
}
