import Link from 'next/link'
import { createDeparture } from './actions'
import { ProcessTrail } from '@/components/process-trail'
import { formatCurrency, formatDate } from '@/lib/format'
import { getDepartureProfitability, getDepartures, getPrograms } from '@/lib/queries'
import { label } from '@/lib/labels'

export default async function DeparturesPage() {
  const [departures, programs, profitability] = await Promise.all([
    getDepartures(50),
    getPrograms(50),
    getDepartureProfitability(50),
  ])
  const profitabilityMap = new Map(profitability.map((item) => [item.departure_id, item]))

  return (
    <div className="content-stack compact-page fullscreen-stretch departures-fullscreen-page">
      <section className="section-head departures-section-head departures-section-head--tight">
        <div>
          <h1 className="page-title">Выезды</h1>
          <p className="muted">Плотный рабочий экран: сверху быстрый ввод выезда, ниже вся сетка по датам, местам, выручке и экономике.</p>
        </div>
        <div className="compact-toolbar departures-toolbar">
          <Link className="button-secondary" href="/dashboard/programs">Программы</Link>
          <Link className="button-secondary" href="/dashboard/controlling">Контроллинг</Link>
        </div>
      </section>

      <ProcessTrail
        items={[
          { label: 'Программы', href: '/dashboard/programs' },
          { label: 'Выезды', href: '/dashboard/departures' },
          { label: 'Сделки', href: '/dashboard/deals' },
          { label: 'Заявки', href: '/dashboard/applications' },
          { label: 'Операционка', href: '/dashboard/ops' },
          { label: 'Контроллинг', href: '/dashboard/controlling' },
        ]}
        current="Выезды"
      />

      <article className="card stack departures-create-card">
        <div className="compact-toolbar departures-create-toolbar">
          <div>
            <h2 style={{ margin: 0 }}>Быстрый ввод выезда</h2>
            <div className="micro">Без тяжёлой вертикальной формы: все ключевые поля собираются в одном компактном блоке.</div>
          </div>
        </div>
        <form action={createDeparture}>
          <div className="compact-form-grid compact-form-grid--departures-top">
            <label>
              Программа
              <select name="program_id" required defaultValue="">
                <option value="" disabled>Выбери программу</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>{program.title}</option>
                ))}
              </select>
            </label>
            <label>
              Название выезда
              <input name="departure_name" placeholder="Июль 2026 / Сиань" required />
            </label>
            <label>
              Город
              <input name="city" placeholder="Сиань" />
            </label>
            <label>
              Статус
              <select name="status" defaultValue="selling">
                <option value="draft">Черновик</option>
                <option value="published">Опубликован</option>
                <option value="selling">В продаже</option>
                <option value="closed">Набор закрыт</option>
                <option value="cancelled">Отменён</option>
              </select>
            </label>
            <label>
              Начало
              <input name="start_date" type="date" required />
            </label>
            <label>
              Конец
              <input name="end_date" type="date" required />
            </label>
            <label>
              Deadline заявок
              <input name="application_deadline" type="date" />
            </label>
            <label>
              Мест
              <input name="seat_capacity" type="number" min="0" defaultValue="20" />
            </label>
            <label>
              Базовая цена
              <input name="base_price" type="number" min="0" step="1000" defaultValue="0" />
            </label>
            <label>
              Валюта
              <select name="currency" defaultValue="RUB">
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="CNY">CNY</option>
              </select>
            </label>
          </div>
          <div className="form-actions departures-form-actions">
            <button className="button">Создать выезд</button>
          </div>
        </form>
      </article>

      <section className="kpi-grid kpi-grid--compact departures-kpi-grid">
        <div className="card kpi"><div className="kpi-label">Выездов в сетке</div><div className="kpi-value">{departures.length}</div><div className="micro">Активные и архивные</div></div>
        <div className="card kpi"><div className="kpi-label">В продаже</div><div className="kpi-value">{departures.filter((item) => item.status === 'selling').length}</div><div className="micro">Текущие продажи</div></div>
        <div className="card kpi"><div className="kpi-label">Оплаченная выручка</div><div className="kpi-value">{formatCurrency(profitability.reduce((sum, item) => sum + (item.paid_revenue || 0), 0))}</div><div className="micro">По всем выездам</div></div>
      </section>

      <article className="card stack departures-registry-card">
        <div className="inline-card departures-inline-card">
          <div>
            <h2 style={{ margin: 0 }}>Сетка выездов</h2>
            <div className="micro">Даты, места, базовая цена, выручка и следующие переходы читаются без длинной прокрутки.</div>
          </div>
          <div className="compact-badges">
            <span className="badge">Всего: {departures.length}</span>
            <span className="badge">Программ: {programs.length}</span>
          </div>
        </div>
        <div className="table-wrap table-wrap--compact-view departures-table-wrap">
          <table className="table compact-table departures-table departures-table--dense">
            <thead>
              <tr>
                <th>Выезд</th>
                <th>Даты / город</th>
                <th>Места</th>
                <th>Цена</th>
                <th>Статус</th>
                <th>Выручка / прибыль</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {departures.map((departure) => {
                const econ = profitabilityMap.get(departure.id)
                return (
                  <tr key={departure.id}>
                    <td>
                      <div><strong><Link href={`/dashboard/departures/${departure.id}`}>{departure.departure_name}</Link></strong></div>
                      <div className="micro">{departure.program?.title || 'Программа не выбрана'}</div>
                    </td>
                    <td>
                      <div>{formatDate(departure.start_date)} — {formatDate(departure.end_date)}</div>
                      <div className="micro">{departure.city || 'Город не указан'}</div>
                    </td>
                    <td>
                      <div>{departure.seat_capacity}</div>
                      <div className="micro">Дедлайн: {formatDate(departure.application_deadline)}</div>
                    </td>
                    <td>{formatCurrency(departure.base_price, departure.currency)}</td>
                    <td>{label('departureStatus', departure.status)}</td>
                    <td>
                      <div>{formatCurrency(econ?.paid_revenue ?? 0)}</div>
                      <div className="micro">Валовая: {formatCurrency(econ?.gross_profit ?? 0)}</div>
                    </td>
                    <td>
                      <div className="registry-actions registry-actions--departures-row">
                        <Link className="button-secondary" href={`/dashboard/departures/${departure.id}`}>Карточка</Link>
                        <Link className="button-secondary" href={`/dashboard/applications?departure_id=${departure.id}`}>Участники</Link>
                        <Link className="button-secondary" href={`/dashboard/ops/${departure.id}`}>Ops</Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
