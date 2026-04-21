import Link from 'next/link'
import { KpiCard } from '@/components/kpi-card'
import { formatCurrency, formatDate } from '@/lib/format'
import { label, controllingExpenseKindOptions, controllingExpenseNatureOptions, controllingExpenseScopeOptions, controllingExpenseStatusOptions } from '@/lib/labels'
import { getControllingExpenses, getControllingExpensesByDeparture, getControllingSummary, getDepartureById, getDepartureProfitability, getDepartures } from '@/lib/queries'
import { createControllingExpenseAction, updateControllingExpenseStatusAction } from './actions'

export default async function ControllingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}
  const departureId = typeof params?.departure_id === 'string' ? params.departure_id : null
  const createMode = typeof params?.create === 'string' ? params.create : null
  const today = new Date().toISOString().slice(0, 10)

  const [summary, expenses, departureProfitability, departures, departure] = await Promise.all([
    getControllingSummary(),
    departureId ? getControllingExpensesByDeparture(departureId, 80) : getControllingExpenses(80),
    getDepartureProfitability(200),
    getDepartures(100),
    departureId ? getDepartureById(departureId) : Promise.resolve(null),
  ])

  const filteredProfitability = departureId
    ? departureProfitability.filter((row) => row.departure_id === departureId)
    : departureProfitability

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Контроллинг</h1>
          <p className="muted">Здесь деньги перестают быть миражом. Выручка минус себестоимость поездок и операционные расходы дают реальную чистую прибыль.</p>
        </div>
        <div className="form-actions">
          <Link className="button-secondary" href="/dashboard/controlling?create=expense#create-expense">Добавить расход</Link>
          {departure ? <Link className="button-secondary" href={`/dashboard/departures/${departure.id}`}>К выезду</Link> : null}
          {departureId ? <Link className="button-secondary" href="/dashboard/controlling">Показать весь контроллинг</Link> : null}
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Оплаченная выручка" value={formatCurrency(summary.paid_revenue)} footnote="Факт по paid-платежам" />
        <KpiCard label="Себестоимость поездок" value={formatCurrency(summary.cogs_total)} footnote="COGS по выездам" />
        <KpiCard label="Операционные расходы" value={formatCurrency(summary.operating_expenses_total)} footnote="Компания, команда, маркетинг, офис" />
        <KpiCard label="Валовая прибыль" value={formatCurrency(summary.gross_profit)} footnote="Выручка минус себестоимость" />
        <KpiCard label="Чистая прибыль" value={formatCurrency(summary.net_profit)} footnote="Валовая прибыль минус операционные расходы" />
        <KpiCard label="Постоянные расходы" value={formatCurrency(summary.fixed_expenses_total)} footnote="Повторяются и давят на маржу" />
        <KpiCard label="Непостоянные расходы" value={formatCurrency(summary.variable_expenses_total)} footnote="Зависят от загрузки и активности" />
      </section>

      <section className="grid-2">
        <article id="create-expense" className={`card stack${createMode === 'expense' ? ' card-focus' : ''}`}>
          <h2 style={{ margin: 0 }}>{departure ? `Новая строка по выезду ${departure.departure_name}` : 'Новая строка контроллинга'}</h2>
          <form action={createControllingExpenseAction}>
            <div className="form-grid">
              <label>
                Название строки
                <input name="title" placeholder="Например: Перелёты по выезду в Сеул" required />
              </label>
              <label>
                Категория
                <input name="category" placeholder="маркетинг / визы / проживание / зарплаты" />
              </label>
              <label>
                Вид
                <select name="expense_kind" defaultValue={departure ? 'cogs' : 'operating'}>
                  {controllingExpenseKindOptions.map((option) => (
                    <option key={option} value={option}>{label('controllingExpenseKind', option)}</option>
                  ))}
                </select>
              </label>
              <label>
                Характер
                <select name="expense_nature" defaultValue="variable">
                  {controllingExpenseNatureOptions.map((option) => (
                    <option key={option} value={option}>{label('controllingExpenseNature', option)}</option>
                  ))}
                </select>
              </label>
              <label>
                Контур расхода
                <select name="scope_type" defaultValue={departure ? 'departure' : 'company'}>
                  {controllingExpenseScopeOptions.map((option) => (
                    <option key={option} value={option}>{label('controllingExpenseScope', option)}</option>
                  ))}
                </select>
              </label>
              <label>
                Привязка к выезду
                <select name="departure_id" defaultValue={departure?.id ?? ''}>
                  <option value="">Без выезда / на компанию</option>
                  {departures.map((item) => (
                    <option key={item.id} value={item.id}>{item.departure_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Сумма
                <input name="amount" type="number" step="0.01" min="0" defaultValue="0" required />
              </label>
              <label>
                Валюта
                <select name="currency" defaultValue={departure?.currency || 'RUB'}>
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CNY">CNY</option>
                </select>
              </label>
              <label>
                Дата признания
                <input name="recognized_on" type="date" defaultValue={today} required />
              </label>
              <label>
                Статус
                <select name="status" defaultValue="active">
                  {controllingExpenseStatusOptions.map((option) => (
                    <option key={option} value={option}>{label('controllingExpenseStatus', option)}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Комментарий
              <textarea name="notes" placeholder="Почему эта строка попадает в контроллинг и как её учитывать" />
            </label>
            <div className="form-actions">
              <button className="button">Добавить строку</button>
            </div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>{departure ? 'Что считается по этому выезду' : 'Что именно считается здесь'}</h2>
          <ul className="list">
            <li><strong>Себестоимость поездки</strong> — прямые расходы, без которых конкретный выезд невозможен: визы, перелёты, проживание, страховка, логистика, сопровождение.</li>
            <li><strong>Операционные расходы</strong> — постоянные и непостоянные затраты компании: зарплаты, реклама, офис, сервисы, подрядчики.</li>
            <li><strong>Валовая прибыль</strong> = оплаченная выручка − себестоимость поездок.</li>
            <li><strong>Чистая прибыль</strong> = валовая прибыль − операционные расходы.</li>
            <li>Если расход относится к конкретному выезду, привяжи его к выезду. Тогда он попадёт и в свод по прибыли поездки.</li>
          </ul>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>{departure ? `Прибыльность выезда ${departure.departure_name}` : 'Прибыльность по выездам'}</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Выезд</th>
                <th>Участники</th>
                <th>Оплаченная выручка</th>
                <th>Себестоимость</th>
                <th>Валовая прибыль</th>
                <th>Маржа</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfitability.map((row) => (
                <tr key={row.departure_id}>
                  <td>
                    <div>{row.departure_name}</div>
                    <div className="micro">{formatDate(row.start_date)} · {row.status || '—'}</div>
                  </td>
                  <td>{row.applications_count}</td>
                  <td>{formatCurrency(row.paid_revenue)}</td>
                  <td>{formatCurrency(row.cogs_total)}</td>
                  <td>{formatCurrency(row.gross_profit)}</td>
                  <td>{row.margin_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>{departure ? 'Строки контроллинга этого выезда' : 'Реестр строк контроллинга'}</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Строка</th>
                <th>Классификация</th>
                <th>Контур</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Обновить</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.recognized_on)}</td>
                  <td>
                    <div>{expense.title}</div>
                    <div className="micro">{expense.category || 'Без категории'}</div>
                    <div className="micro">{expense.notes || '—'}</div>
                  </td>
                  <td>
                    <div>{label('controllingExpenseKind', expense.expense_kind)}</div>
                    <div className="micro">{label('controllingExpenseNature', expense.expense_nature)}</div>
                  </td>
                  <td>
                    <div>{label('controllingExpenseScope', expense.scope_type)}</div>
                    <div className="micro">{expense.departure?.departure_name || 'На компанию'}</div>
                  </td>
                  <td>{formatCurrency(expense.amount, expense.currency)}</td>
                  <td>{label('controllingExpenseStatus', expense.status)}</td>
                  <td>
                    <form action={updateControllingExpenseStatusAction}>
                      <input type="hidden" name="expense_id" value={expense.id} />
                      <div className="stack" style={{ minWidth: 220 }}>
                        <select name="status" defaultValue={expense.status}>
                          {controllingExpenseStatusOptions.map((option) => (
                            <option key={option} value={option}>{label('controllingExpenseStatus', option)}</option>
                          ))}
                        </select>
                        <input name="notes" defaultValue={expense.notes || ''} placeholder="Комментарий" />
                        <button className="button-secondary">Сохранить</button>
                      </div>
                    </form>
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
