import Link from 'next/link'
import { ProcessTrail } from '@/components/process-trail'
import { formatDate, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { createClient } from '@/lib/supabase/server'
import { seedDepartureOpsChecklistAction } from './actions'

export default async function OpsPage() {
  const supabase = await createClient()
  const [opsRes, nextUpdatesRes] = await Promise.all([
    supabase.from('reporting_departure_ops').select('*').order('start_date', { ascending: true }),
    supabase
      .from('trip_updates')
      .select('id, departure_id, audience, title, created_at, departures:departures(departure_name)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const departures = opsRes.data ?? []
  const recentUpdates = nextUpdatesRes.data ?? []

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Операционка выездов</h1>
          <p className="muted">Здесь колёса касаются земли: группы, логистика, визы, безопасность, брифинги и ежедневные обновления по выездам.</p>
        </div>
      </section>

      <ProcessTrail
        items={[
          { label: 'Программы', href: '/dashboard/programs' },
          { label: 'Выезды', href: '/dashboard/departures' },
          { label: 'Заявки', href: '/dashboard/applications' },
          { label: 'Операционка', href: '/dashboard/ops' },
          { label: 'Отчёты', href: '/dashboard/reports' },
        ]}
        current="Операционка"
      />

      <section className="grid-2">
        <article className="card flow-card">
          <h2 className="flow-card-title">Как участники попадают сюда</h2>
          <div className="process-trail">
            <span className="process-trail-item">Сделка</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item">Заявка</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item">Выезд</span>
            <span className="process-trail-arrow">→</span>
            <span className="process-trail-item active">Операционка</span>
          </div>
          <ul className="list">
            <li>Операционка не создаёт участников сама. Они приходят из заявок, у которых указан конкретный выезд.</li>
            <li>Редактирование самого выезда, цены, статуса и экономики находится в карточке выезда.</li>
            <li>Редактирование чек-листа и trip updates находится в карточке ops выезда.</li>
          </ul>
          <div className="flow-card-links">
            <Link className="button-secondary" href="/dashboard/applications">Открыть заявки</Link>
            <Link className="button-secondary" href="/dashboard/departures">Открыть выезды</Link>
          </div>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Что редактируется здесь</h2>
          <div className="micro">На уровне карточки выезда и ops можно:</div>
          <ul className="list">
            <li>создавать и обновлять пункты ops-чек-листа;</li>
            <li>назначать сроки и приоритеты;</li>
            <li>публиковать trip updates для семьи, команды и партнёров;</li>
            <li>смотреть участников, прикреплённых к выезду.</li>
          </ul>
        </article>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Выезды под управлением</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Выезд</th>
                  <th>Программа</th>
                  <th>Участники</th>
                  <th>Готовность</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {departures.map((departure) => (
                  <tr key={departure.departure_id}>
                    <td>
                      <div>{departure.departure_name}</div>
                      <div className="micro">
                        {formatDate(departure.start_date)} — {formatDate(departure.end_date)}
                      </div>
                    </td>
                    <td>{departure.program_title || '—'}</td>
                    <td>{departure.applications_count}</td>
                    <td>
                      <div>{departure.ops_items_done}/{departure.ops_items_total}</div>
                      <div className="micro">{departure.ops_completion_pct}% готовности</div>
                    </td>
                    <td>
                      <div className="form-actions">
                        <Link className="button-secondary" href={`/dashboard/departures/${departure.departure_id}`}>
                          Карточка
                        </Link>
                        <Link className="button-secondary" href={`/dashboard/applications?departure_id=${departure.departure_id}`}>
                          Участники
                        </Link>
                        <Link className="button-secondary" href={`/dashboard/ops/${departure.departure_id}`}>
                          Ops
                        </Link>
                        <form action={seedDepartureOpsChecklistAction}>
                          <input type="hidden" name="departure_id" value={departure.departure_id} />
                          <button className="button">Заполнить стартовый чек-лист</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Последние обновления по выездам</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Выезд</th>
                  <th>Аудитория</th>
                  <th>Сообщение</th>
                  <th>Когда</th>
                </tr>
              </thead>
              <tbody>
                {recentUpdates.map((update) => (
                  <tr key={update.id}>
                    <td>{(update.departures as { departure_name?: string | null } | null)?.departure_name || '—'}</td>
                    <td>{label('audience', update.audience)}</td>
                    <td>{update.title}</td>
                    <td>{formatDateTime(update.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  )
}
