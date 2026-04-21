import Link from 'next/link'
import { createPaymentAction, markPaymentPaidAction, updatePaymentProgressAction } from './actions'
import { ProcessTrail } from '@/components/process-trail'
import { requireStaff } from '@/lib/auth'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { label, paymentStatusOptions } from '@/lib/labels'
import { canPerform } from '@/lib/roles'
import {
  getApplicationById,
  getControllingSummary,
  getDealById,
  getPayments,
  getPaymentsByDeal,
} from '@/lib/queries'

export default async function FinancePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const applicationId = typeof params?.application_id === 'string' ? params.application_id : null
  const explicitDealId = typeof params?.deal_id === 'string' ? params.deal_id : null
  const createMode = typeof params?.create === 'string' ? params.create : null

  const { profile } = await requireStaff()
  const canCreatePayment = canPerform(profile?.role, 'finance.payment_create')
  const canMarkPaid = canPerform(profile?.role, 'finance.payment_mark_paid')

  const application = applicationId ? await getApplicationById(applicationId) : null
  const linkedDealId = explicitDealId || application?.deal?.id || application?.deal_id || null

  const [payments, controlling, deal] = await Promise.all([
    linkedDealId
      ? getPaymentsByDeal(linkedDealId, 80)
      : getPayments(80),
    getControllingSummary(),
    linkedDealId ? getDealById(linkedDealId) : Promise.resolve(null),
  ])

  const contextTitle = deal
    ? `Платежи по сделке ${deal.title}`
    : 'Реестр платежей'

  const contextText = deal
    ? 'Здесь видно денежный контур конкретной сделки.'
    : 'Компактный финансовый экран: сверху быстрый ввод, ниже единый плотный реестр.'

  return (
    <div className="content-stack compact-page fullscreen-stretch finance-fullscreen-page">
      <section className="section-head finance-section-head finance-section-head--tight">
        <div>
          <h1 className="page-title">Финансы</h1>
          <p className="muted">{contextText}</p>
        </div>
        <div className="compact-toolbar finance-toolbar">
          {deal ? <Link className="button-secondary" href={`/dashboard/deals?open=${deal.id}#deal-editor`}>К сделке</Link> : null}
          <Link className="button-secondary" href="/dashboard/controlling">Контроллинг</Link>
        </div>
      </section>

      <ProcessTrail
        items={[
          { label: 'Лиды', href: '/dashboard/leads' },
          { label: 'Сделки', href: '/dashboard/deals' },
          { label: 'Договоры', href: '/dashboard/contracts' },
          { label: 'Финансы', href: '/dashboard/finance' },
          { label: 'Контроллинг', href: '/dashboard/controlling' },
        ]}
        current="Финансы"
      />

      <article id="create-payment" className={`card stack finance-create-card${createMode === 'payment' ? ' card-focus' : ''}`}>
        <div className="compact-toolbar finance-create-toolbar">
          <div>
            <h2 style={{ margin: 0 }}>Быстрый ввод платежа</h2>
            <div className="micro">
              {deal
                ? 'Платёж создаётся прямо по выбранной сделке.'
                : 'Создай общий платёж по сделке или вручную для реестра.'}
            </div>
          </div>
        </div>
        {canCreatePayment ? (
          <form action={createPaymentAction}>
            {linkedDealId ? <input type="hidden" name="deal_id" value={linkedDealId} /> : null}
            <div className="compact-form-grid compact-form-grid--finance-top">
              <label>
                Сделка
                <select name="application_id" defaultValue="">
                  <option value="">{deal ? 'На всю сделку' : 'Без внутренней привязки'}</option>
                </select>
              </label>
              <label>
                Плательщик
                <input name="payer_name" defaultValue={deal?.account?.display_name || ''} placeholder="ФИО плательщика" />
              </label>
              <label>
                Назначение
                <input name="label" defaultValue="Предоплата" placeholder="Предоплата / доплата / остаток" required />
              </label>
              <label>
                Сумма
                <input name="amount" type="number" min="0" step="1000" placeholder="50000" required />
              </label>
              <label>
                Валюта
                <select name="currency" defaultValue={deal?.currency || 'RUB'}>
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CNY">CNY</option>
                </select>
              </label>
              <label>
                Срок оплаты
                <input name="due_date" type="date" />
              </label>
              <label>
                Статус
                <select name="status" defaultValue="pending">
                  {paymentStatusOptions.map((status) => (
                    <option key={status} value={status}>{label('paymentStatus', status)}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-actions finance-form-actions">
              <button className="button">Создать платёж</button>
              {linkedDealId ? <Link className="button-secondary" href="/dashboard/finance">Сбросить фильтр</Link> : null}
            </div>
          </form>
        ) : (
          <div className="notice">У этой роли нет права создавать платежи из финреестра.</div>
        )}
      </article>

      <section className="kpi-grid kpi-grid--compact finance-kpi-grid">
        <div className="card kpi"><div className="kpi-label">Оплаченная выручка</div><div className="kpi-value">{formatCurrency(controlling.paid_revenue)}</div><div className="micro">По paid-платежам</div></div>
        <div className="card kpi"><div className="kpi-label">Валовая прибыль</div><div className="kpi-value">{formatCurrency(controlling.gross_profit)}</div><div className="micro">Минус себестоимость поездок</div></div>
        <div className="card kpi"><div className="kpi-label">Чистая прибыль</div><div className="kpi-value">{formatCurrency(controlling.net_profit)}</div><div className="micro">Минус операционные расходы</div></div>
      </section>

      <article className="card stack finance-registry-card">
        <div className="inline-card finance-inline-card">
          <div>
            <h2 style={{ margin: 0 }}>{contextTitle}</h2>
            <div className="micro">После установки цены в сделке здесь сразу появляется строка платежа. Вноси оплаченную часть прямо в реестре.</div>
          </div>
          <div className="compact-badges">
            <span className="badge">Всего: {payments.length}</span>
          </div>
        </div>
        <div className="table-wrap table-wrap--compact-view finance-table-wrap">
          <table className="table compact-table finance-table finance-table--dense">
            <thead>
              <tr>
                <th>Плательщик</th>
                <th>Источник</th>
                <th>Назначение</th>
                <th>Сумма</th>
                <th>Срок</th>
                <th>Статус</th>
                <th>Оплачено / остаток</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <div><strong>{payment.payer_name}</strong></div>
                    <div className="micro">Создан: {formatDateTime(payment.created_at)}</div>
                  </td>
                  <td>
                    <div>{payment.deal ? 'Сделка' : 'Ручной платёж'}</div>
                    <div className="micro">{payment.deal ? <Link href={`/dashboard/deals?open=${payment.deal.id}#deal-editor`}>{payment.deal.title}</Link> : 'Без сделки'}</div>
                  </td>
                  <td>{payment.label}</td>
                  <td>{formatCurrency(payment.amount, payment.currency)}</td>
                  <td>{formatDate(payment.due_date)}</td>
                  <td>{label('paymentStatus', payment.status)}</td>
                  <td>
                    <div><strong>{formatCurrency(payment.paid_amount || 0, payment.currency)}</strong></div>
                    <div className="micro">Осталось: {formatCurrency(Math.max(0, Number(payment.amount || 0) - Number(payment.paid_amount || 0)), payment.currency)}</div>
                    <div className="micro">Дата: {formatDateTime(payment.paid_at)}</div>
                  </td>
                  <td>
                    <div className="registry-actions registry-actions--finance-row">
                      {canMarkPaid ? (
                        <form action={updatePaymentProgressAction} className="finance-progress-form">
                          <input type="hidden" name="payment_id" value={payment.id} />
                          <input type="hidden" name="application_id" value={payment.application_id || ''} />
                          <input type="hidden" name="deal_id" value={payment.deal_id || ''} />
                          <input name="paid_amount" type="number" min="0" step="1000" defaultValue={payment.paid_amount || 0} placeholder="Сколько оплачено" />
                          <button className="button">Сохранить оплату</button>
                        </form>
                      ) : <span className="micro">Ждёт финансы</span>}
                      {payment.status !== 'paid' && canMarkPaid ? (
                        <form action={markPaymentPaidAction}>
                          <input type="hidden" name="payment_id" value={payment.id} />
                          <input type="hidden" name="application_id" value={payment.application_id || ''} />
                          <input type="hidden" name="deal_id" value={payment.deal_id || ''} />
                          <input type="hidden" name="note" value="Оплачено вручную из CRM" />
                          <button className="button-secondary">Закрыть полностью</button>
                        </form>
                      ) : null}
                      <Link className="button-secondary" href={`/dashboard/contracts?deal_id=${payment.deal_id || ''}`}>Договор</Link>
                    </div>
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
