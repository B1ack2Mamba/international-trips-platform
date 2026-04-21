import Link from 'next/link'
import { label } from '@/lib/labels'
import { getPublicPrograms } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const partnerCode = typeof params.partner_code === 'string' ? params.partner_code : ''
  const programs = await getPublicPrograms(50)

  return (
    <main className="container section">
      <section className="section-head">
        <div>
          <h1 className="page-title">Программы и поездки</h1>
          <p className="muted">Публичный каталог, который объясняет продукт без десяти голосовых подряд.</p>
        </div>
      </section>

      {partnerCode ? (
        <section className="card inline-card">
          <div>
            <div className="micro">Партнёрский режим</div>
            <div style={{ fontWeight: 700 }}>Код источника: {partnerCode}</div>
          </div>
          <div className="micro">Все заявки из этого каталога будут атрибутированы партнёрскому каналу.</div>
        </section>
      ) : null}

      <section className="grid-3">
        {programs.map((program) => (
          <article key={program.id} className="card stack">
            <div className="badge-row">
              <span className="badge success">{label('segment', program.segment)}</span>
              <span className="badge">{label('tripType', program.trip_type)}</span>
            </div>
            <h2 style={{ margin: 0 }}>{program.title}</h2>
            <div className="micro">{[program.country, program.city].filter(Boolean).join(', ')}</div>
            <p className="muted" style={{ margin: 0 }}>
              {program.short_description || 'Описание пока не заполнено.'}
            </p>
            <div className="inline-card">
              <div className="micro">
                {program.duration_days} дней · {program.language || 'язык уточняется'}
              </div>
              <Link
                className="button"
                href={partnerCode ? `/programs/${program.public_slug}?partner_code=${encodeURIComponent(partnerCode)}` : `/programs/${program.public_slug}`}
              >
                Открыть программу
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
