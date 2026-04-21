import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/format'
import { label } from '@/lib/labels'
import { getProgramBySlug, getProgramDepartures } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const search = (await searchParams) ?? {}
  const status = typeof search.status === 'string' ? search.status : ''
  const utmSource = typeof search.utm_source === 'string' ? search.utm_source : ''
  const utmMedium = typeof search.utm_medium === 'string' ? search.utm_medium : ''
  const utmCampaign = typeof search.utm_campaign === 'string' ? search.utm_campaign : ''
  const utmContent = typeof search.utm_content === 'string' ? search.utm_content : ''
  const utmTerm = typeof search.utm_term === 'string' ? search.utm_term : ''
  const partnerCode = typeof search.partner_code === 'string' ? search.partner_code : ''

  const program = await getProgramBySlug(slug)
  if (!program) notFound()

  const departures = await getProgramDepartures(program.id)

  return (
    <main className="container section">
      <section className="grid-2">
        <article className="card stack">
          <div className="badge-row">
            <span className="badge success">{label('segment', program.segment)}</span>
            <span className="badge">{label('tripType', program.trip_type)}</span>
            <span className="badge">{program.language || 'язык уточняется'}</span>
          </div>
          <h1 className="page-title">{program.title}</h1>
          <p className="muted">
            {[program.country, program.city].filter(Boolean).join(', ')} · {program.duration_days} дней
          </p>
          <p className="lead" style={{ margin: 0 }}>
            {program.short_description || program.description}
          </p>
          <div className="notice">
            Здесь пользователь должен понимать программу так, чтобы решение не зависело от длинной
            переписки в мессенджере.
          </div>
          {partnerCode ? (
            <div className="notice">
              Этот лендинг открыт по партнёрскому коду <strong>{partnerCode}</strong>. Все заявки
              будут привязаны к партнёру и попадут в защищённый контур.
            </div>
          ) : null}
          <Link className="button-secondary" href={partnerCode ? `/programs?partner_code=${encodeURIComponent(partnerCode)}` : '/programs'}>
            Назад к каталогу
          </Link>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Оставить заявку</h2>
          {status === 'success' ? <div className="notice">Заявка отправлена. Она уже должна лежать в CRM в разделе «Лиды».</div> : null}
          {status === 'error' ? <div className="badge danger">Не удалось отправить заявку. Проверь env и миграции.</div> : null}
          <form action="/api/public/lead" method="post">
            <input type="hidden" name="program_slug" value={slug} />
            <input type="hidden" name="source_channel" value={partnerCode ? 'partner' : 'website'} />
            <input type="hidden" name="partner_code" value={partnerCode} />
            <input type="hidden" name="website" value="" />
            <input type="hidden" name="utm_source" value={utmSource} />
            <input type="hidden" name="utm_medium" value={utmMedium} />
            <input type="hidden" name="utm_campaign" value={utmCampaign} />
            <input type="hidden" name="utm_content" value={utmContent} />
            <input type="hidden" name="utm_term" value={utmTerm} />
            <div className="form-grid">
              <label>
                Имя
                <input name="contact_name_raw" placeholder="Анна Иванова" required />
              </label>
              <label>
                Телефон
                <input name="phone_raw" placeholder="+7 900 000-00-00" required />
              </label>
              <label>
                Email
                <input name="email_raw" type="email" placeholder="parent@example.com" />
              </label>
              <label>
                Страна интереса
                <input name="desired_country" defaultValue={program.country ?? ''} />
              </label>
              <label>
                Ближайший выезд
                <select name="desired_departure_id" defaultValue="">
                  <option value="">Подберите мне вариант</option>
                  {departures.map((departure) => (
                    <option key={departure.id} value={departure.id}>
                      {departure.departure_name} · {formatDate(departure.start_date)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Комментарий
              <textarea name="message" placeholder="Ищем безопасную программу для подростка на лето" />
            </label>
            <div className="form-actions">
              <button className="button">Отправить заявку</button>
            </div>
          </form>
        </article>
      </section>

      <section className="section">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Ближайшие выезды</h2>
          {departures.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Выезд</th>
                    <th>Даты</th>
                    <th>Мест</th>
                    <th>Цена</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {departures.map((departure) => (
                    <tr key={departure.id}>
                      <td>{departure.departure_name}</td>
                      <td>
                        {formatDate(departure.start_date)} — {formatDate(departure.end_date)}
                      </td>
                      <td>{departure.seat_capacity}</td>
                      <td>{formatCurrency(departure.base_price, departure.currency)}</td>
                      <td>{label('departureStatus', departure.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="muted">Пока нет опубликованных выездов для этой программы.</div>
          )}
        </article>
      </section>
    </main>
  )
}
