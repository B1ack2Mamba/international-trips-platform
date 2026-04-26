import Link from 'next/link'
import { ProcessTrail } from '@/components/process-trail'
import { notFound } from 'next/navigation'
import { formatDate, formatDateTime } from '@/lib/format'
import { label, priorityOptions, taskStatusOptions } from '@/lib/labels'
import { createClient } from '@/lib/supabase/server'
import {
  createDepartureOpsItemAction,
  createTripUpdateAction,
  updateDepartureOpsItemAction,
} from '../actions'

export default async function DepartureOpsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [departureRes, itemsRes, applicationsRes, updatesRes] = await Promise.all([
    supabase
      .from('departures')
      .select('id, departure_name, start_date, end_date, status, city, program:programs(title, country)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('departure_ops_items')
      .select('id, application_id, category, title, description, status, priority, due_at, sort_order, metadata, application:applications(participant_name)')
      .eq('departure_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('applications')
      .select('id, participant_name, status')
      .eq('departure_id', id)
      .order('participant_name', { ascending: true }),
    supabase
      .from('trip_updates')
      .select('id, title, body, audience, is_published, published_at, created_at')
      .eq('departure_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const departure = departureRes.data
  if (!departure) notFound()

  const items = itemsRes.data ?? []
  const applications = applicationsRes.data ?? []
  const updates = updatesRes.data ?? []
  const opsCategories = ['group', 'documents', 'visa', 'flights', 'hotel', 'insurance', 'briefing', 'finance', 'safety', 'other']

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <div className="micro">Операционка / {departure.id.slice(0, 8)}</div>
          <h1 className="page-title">{departure.departure_name}</h1>
          <p className="muted">
            {formatDate(departure.start_date)} — {formatDate(departure.end_date)} · {(departure.program as { title?: string | null } | null)?.title || 'Программа'}
          </p>
        </div>
        <div className="form-actions">
          <Link className="button-secondary" href={`/dashboard/departures/${departure.id}`}>Карточка выезда</Link>
          <Link className="button-secondary" href="/dashboard/ops">Назад к списку</Link>
        </div>
      </section>

      <ProcessTrail
        items={[
          { label: 'Выезды', href: '/dashboard/departures' },
          { label: 'Карточка выезда', href: `/dashboard/departures/${departure.id}` },
          { label: 'Участники', href: `/dashboard/participants?departure_id=${departure.id}` },
          { label: 'Операционка', href: '/dashboard/ops' },
          { label: 'Отчёты', href: '/dashboard/reports' },
        ]}
        current="Операционка"
      />

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Добавить операционный пункт</h2>
          <form action={createDepartureOpsItemAction}>
            <input type="hidden" name="departure_id" value={departure.id} />
            <div className="form-grid">
              <label>
                Категория
                <select name="category" defaultValue="group">
                  {opsCategories.map((category) => (
                    <option key={category} value={category}>{label('opsCategory', category)}</option>
                  ))}
                </select>
              </label>
              <label>
                Заявка (необязательно)
                <select name="application_id" defaultValue="">
                  <option value="">Групповой уровень</option>
                  {applications.map((application) => (
                    <option key={application.id} value={application.id}>
                      {application.participant_name} · {label('applicationStatus', application.status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Статус
                <select name="status" defaultValue="todo">
                  {taskStatusOptions.map((status) => (
                    <option key={status} value={status}>{label('taskStatus', status)}</option>
                  ))}
                </select>
              </label>
              <label>
                Приоритет
                <select name="priority" defaultValue="medium">
                  {priorityOptions.map((priority) => (
                    <option key={priority} value={priority}>{label('priority', priority)}</option>
                  ))}
                </select>
              </label>
              <label>
                Срок
                <input name="due_at" type="datetime-local" />
              </label>
              <label>
                Порядок сортировки
                <input name="sort_order" type="number" defaultValue="100" />
              </label>
            </div>
            <label>
              Заголовок
              <input name="title" placeholder="Подтвердить отель" required />
            </label>
            <label>
              Описание
              <textarea name="description" placeholder="Что именно нужно закрыть по этому пункту" />
            </label>
            <div className="form-actions">
              <button className="button">Добавить пункт</button>
            </div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Добавить обновление</h2>
          <form action={createTripUpdateAction}>
            <input type="hidden" name="departure_id" value={departure.id} />
            <div className="form-grid">
              <label>
                Аудитория
                <select name="audience" defaultValue="internal">
                  {['internal', 'family', 'partner'].map((audience) => (
                    <option key={audience} value={audience}>{label('audience', audience)}</option>
                  ))}
                </select>
              </label>
              <label className="inline-checkbox">
                <input name="is_published" type="checkbox" />
                <span>Сразу опубликовать</span>
              </label>
            </div>
            <label>
              Заголовок
              <input name="title" placeholder="Родительский брифинг назначен" required />
            </label>
            <label>
              Текст
              <textarea name="body" placeholder="Ключевое обновление по выезду" required />
            </label>
            <div className="form-actions">
              <button className="button-secondary">Сохранить обновление</button>
            </div>
          </form>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Операционный чек-лист</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Пункт</th>
                <th>Категория</th>
                <th>Заявка</th>
                <th>Статус</th>
                <th>Срок</th>
                <th>Обновить</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>{item.title}</div>
                    <div className="micro">{item.description || '—'}</div>
                  </td>
                  <td>{label('opsCategory', item.category)}</td>
                  <td>{(item.application as { participant_name?: string | null } | null)?.participant_name || 'Группа'}</td>
                  <td>{label('taskStatus', item.status)}</td>
                  <td>{formatDateTime(item.due_at)}</td>
                  <td>
                    <form action={updateDepartureOpsItemAction}>
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="departure_id" value={departure.id} />
                      <div className="form-grid">
                        <label>
                          <select name="status" defaultValue={item.status}>
                            {taskStatusOptions.map((status) => (
                              <option key={status} value={status}>{label('taskStatus', status)}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <select name="priority" defaultValue={item.priority}>
                            {priorityOptions.map((priority) => (
                              <option key={priority} value={priority}>{label('priority', priority)}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <input name="due_at" type="datetime-local" />
                        </label>
                      </div>
                      <label>
                        <input name="note" placeholder="Что изменилось" />
                      </label>
                      <div className="form-actions">
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

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Обновления по выезду</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Аудитория</th>
                <th>Сообщение</th>
                <th>Опубликовано</th>
                <th>Создано</th>
              </tr>
            </thead>
            <tbody>
              {updates.map((update) => (
                <tr key={update.id}>
                  <td>{label('audience', update.audience)}</td>
                  <td>
                    <div>{update.title}</div>
                    <div className="micro">{update.body}</div>
                  </td>
                  <td>{update.is_published ? formatDateTime(update.published_at) : 'Нет'}</td>
                  <td>{formatDateTime(update.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
