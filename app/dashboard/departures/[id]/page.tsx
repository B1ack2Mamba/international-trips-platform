import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProcessTrail } from '@/components/process-trail'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import {
  controllingExpenseKindOptions,
  controllingExpenseNatureOptions,
  controllingExpenseStatusOptions,
  departureStatusOptions,
  label,
} from '@/lib/labels'
import {
  getActivityLog,
  getApplicationsByDeparture,
  getControllingExpensesByDeparture,
  getDepartureById,
} from '@/lib/queries'
import { createClient } from '@/lib/supabase/server'
import { createControllingExpenseAction } from '@/app/dashboard/controlling/actions'
import { seedDepartureOpsChecklistAction } from '@/app/dashboard/ops/actions'
import { updateDepartureAction } from '../actions'

export default async function DepartureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const departure = await getDepartureById(id)
  if (!departure) notFound()

  const supabase = await createClient()
  const [applications, expenses, profitabilityRes, opsRes, updatesRes, activities] = await Promise.all([
    getApplicationsByDeparture(id, 80),
    getControllingExpensesByDeparture(id, 80),
    supabase.from('reporting_departure_profitability').select('*').eq('departure_id', id).maybeSingle(),
    supabase.from('reporting_departure_ops').select('*').eq('departure_id', id).maybeSingle(),
    supabase.from('trip_updates').select('id, title, audience, is_published, published_at, created_at').eq('departure_id', id).order('created_at', { ascending: false }).limit(10),
    getActivityLog('departure', id, 30),
  ])

  const profitability = profitabilityRes.data
  const ops = opsRes.data
  const updates = updatesRes.data ?? []
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <div className="micro">Выезд / {departure.program?.title || 'Программа'}</div>
          <h1 className="page-title">{departure.departure_name}</h1>
          <p className="muted">
            {formatDate(departure.start_date)} — {formatDate(departure.end_date)} · {departure.city || departure.program?.city || 'Город не указан'}
          </p>
        </div>
        <div className="form-actions">
          <Link className="button-secondary" href="/dashboard/departures">К списку выездов</Link>
          <Link className="button-secondary" href={`/dashboard/participants?departure_id=${departure.id}`}>Участники</Link>
          <Link className="button-secondary" href={`/dashboard/ops/${departure.id}`}>Открыть Ops</Link>
        </div>
      </section>

      <ProcessTrail
        items={[
          { label: 'Программы', href: '/dashboard/programs' },
          { label: 'Выезды', href: '/dashboard/departures' },
          { label: 'Участники', href: '/dashboard/participants' },
          { label: 'Операционка', href: '/dashboard/ops' },
          { label: 'Контроллинг', href: '/dashboard/controlling' },
        ]}
        current="Карточка выезда"
      />

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Контекст выезда</h2>
          <div className="grid-2">
            <div><div className="micro">Программа</div><div>{departure.program?.title || '—'}</div></div>
            <div><div className="micro">Страна / город</div><div>{departure.program?.country || '—'} · {departure.city || departure.program?.city || '—'}</div></div>
            <div><div className="micro">Заявок</div><div>{applications.length}</div></div>
            <div><div className="micro">Мест</div><div>{departure.seat_capacity}</div></div>
            <div><div className="micro">Базовая цена</div><div>{formatCurrency(departure.base_price, departure.currency)}</div></div>
            <div><div className="micro">Deadline</div><div>{formatDate(departure.application_deadline)}</div></div>
            <div><div className="micro">Оплачено</div><div>{formatCurrency(Number(profitability?.paid_revenue ?? 0), departure.currency)}</div></div>
            <div><div className="micro">Себестоимость</div><div>{formatCurrency(Number(profitability?.cogs_total ?? 0), departure.currency)}</div></div>
            <div><div className="micro">Валовая прибыль</div><div>{formatCurrency(Number(profitability?.gross_profit ?? 0), departure.currency)}</div></div>
            <div><div className="micro">Маржа</div><div>{Number(profitability?.margin_pct ?? 0)}%</div></div>
          </div>
          <div className="flow-card-links">
            <Link className="button-secondary" href={`/dashboard/controlling?departure_id=${departure.id}`}>Контроллинг выезда</Link>
            <Link className="button-secondary" href="/dashboard/finance">Реестр платежей</Link>
          </div>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Редактировать выезд</h2>
          <form action={updateDepartureAction}>
            <input type="hidden" name="departure_id" value={departure.id} />
            <div className="form-grid">
              <label>
                Название
                <input name="departure_name" defaultValue={departure.departure_name} required />
              </label>
              <label>
                Город
                <input name="city" defaultValue={departure.city || ''} />
              </label>
              <label>
                Статус
                <select name="status" defaultValue={departure.status}>
                  {departureStatusOptions.map((status) => (
                    <option key={status} value={status}>{label('departureStatus', status)}</option>
                  ))}
                </select>
              </label>
              <label>
                Начало
                <input name="start_date" type="date" defaultValue={departure.start_date || ''} required />
              </label>
              <label>
                Конец
                <input name="end_date" type="date" defaultValue={departure.end_date || ''} required />
              </label>
              <label>
                Deadline заявок
                <input name="application_deadline" type="date" defaultValue={departure.application_deadline || ''} />
              </label>
              <label>
                Мест
                <input name="seat_capacity" type="number" min="0" defaultValue={String(departure.seat_capacity)} />
              </label>
              <label>
                Базовая цена
                <input name="base_price" type="number" step="1000" min="0" defaultValue={String(departure.base_price ?? 0)} />
              </label>
              <label>
                Валюта
                <select name="currency" defaultValue={departure.currency}>
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CNY">CNY</option>
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button className="button">Сохранить выезд</button>
            </div>
          </form>
        </article>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <div className="inline-card">
            <div>
              <h2 style={{ margin: 0 }}>Участники выезда</h2>
              <div className="micro">Именно эти заявки потом попадают в договоры, платежи и операционку.</div>
            </div>
            <Link className="button-secondary" href={`/dashboard/participants?departure_id=${departure.id}`}>Весь реестр</Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Участник</th>
                  <th>Сделка</th>
                  <th>Финансы</th>
                  <th>Дальше</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <div><Link href={`/dashboard/participants/${application.id}`}>{application.participant_name}</Link></div>
                      <div className="micro">{application.guardian_name || application.guardian_email || '—'}</div>
                    </td>
                    <td>{application.deal ? <Link href={`/dashboard/deals/${application.deal.id}`}>{application.deal.title}</Link> : '—'}</td>
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
        </article>

        <article className="card stack">
          <div className="inline-card">
            <div>
              <h2 style={{ margin: 0 }}>Ops и обновления</h2>
              <div className="micro">Карточка выезда — это мостик в операционку, а не её замена.</div>
            </div>
            <Link className="button-secondary" href={`/dashboard/ops/${departure.id}`}>Открыть Ops</Link>
          </div>
          <div className="grid-2">
            <div><div className="micro">Ops-пунктов</div><div>{Number(ops?.ops_items_total ?? 0)}</div></div>
            <div><div className="micro">Готово</div><div>{Number(ops?.ops_items_done ?? 0)} / {Number(ops?.ops_items_total ?? 0)}</div></div>
            <div><div className="micro">Открыто</div><div>{Number(ops?.ops_items_open ?? 0)}</div></div>
            <div><div className="micro">Готовность</div><div>{Number(ops?.ops_completion_pct ?? 0)}%</div></div>
          </div>
          <div className="form-actions">
            <form action={seedDepartureOpsChecklistAction}>
              <input type="hidden" name="departure_id" value={departure.id} />
              <button className="button">Заполнить стартовый чек-лист</button>
            </form>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Аудитория</th>
                  <th>Обновление</th>
                  <th>Когда</th>
                </tr>
              </thead>
              <tbody>
                {updates.map((update) => (
                  <tr key={update.id}>
                    <td>{label('audience', update.audience)}</td>
                    <td>
                      <div>{update.title}</div>
                      <div className="micro">{update.is_published ? 'Опубликовано' : 'Черновик'}</div>
                    </td>
                    <td>{formatDateTime(update.published_at || update.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Быстрая строка себестоимости / расхода</h2>
          <div className="micro">Так выезд можно сразу связать с контроллингом, не прыгая по разделам.</div>
          <form action={createControllingExpenseAction}>
            <input type="hidden" name="departure_id" value={departure.id} />
            <input type="hidden" name="scope_type" value="departure" />
            <div className="form-grid">
              <label>
                Строка
                <input name="title" placeholder="Проживание группы" required />
              </label>
              <label>
                Категория
                <input name="category" placeholder="hotel / visa / flights" />
              </label>
              <label>
                Вид
                <select name="expense_kind" defaultValue="cogs">
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
                Сумма
                <input name="amount" type="number" min="0" step="1000" defaultValue="0" required />
              </label>
              <label>
                Валюта
                <select name="currency" defaultValue={departure.currency}>
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
              <textarea name="notes" placeholder="Что именно входит в эту строку" />
            </label>
            <div className="form-actions">
              <button className="button">Добавить строку</button>
              <Link className="button-secondary" href={`/dashboard/controlling?departure_id=${departure.id}`}>Открыть контроллинг выезда</Link>
            </div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Строки контроллинга этого выезда</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Строка</th>
                  <th>Классификация</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{formatDate(expense.recognized_on)}</td>
                    <td>
                      <div>{expense.title}</div>
                      <div className="micro">{expense.category || 'Без категории'}</div>
                    </td>
                    <td>
                      <div>{label('controllingExpenseKind', expense.expense_kind)}</div>
                      <div className="micro">{label('controllingExpenseNature', expense.expense_nature)}</div>
                    </td>
                    <td>{formatCurrency(expense.amount, expense.currency)}</td>
                    <td>{label('controllingExpenseStatus', expense.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>История выезда</h2>
        {activities.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Событие</th>
                  <th>Комментарий</th>
                  <th>Кто</th>
                  <th>Когда</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id}>
                    <td><div>{activity.title}</div><div className="micro">{activity.event_type}</div></td>
                    <td>{activity.body || '—'}</td>
                    <td>{activity.actor?.full_name || activity.actor?.email || 'system'}</td>
                    <td>{formatDateTime(activity.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="muted">История выезда пока пустая.</div>}
      </article>
    </div>
  )
}
