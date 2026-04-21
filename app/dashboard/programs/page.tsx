import { createProgram } from './actions'
import { label, segmentOptions, tripTypeOptions } from '@/lib/labels'
import { getPrograms } from '@/lib/queries'

export default async function ProgramsPage() {
  const programs = await getPrograms(50)

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Программы</h1>
          <p className="muted">Продукт должен быть формализован, иначе продажа всегда будет импровизацией.</p>
        </div>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Добавить программу</h2>
          <form action={createProgram}>
            <div className="form-grid">
              <label>
                Код
                <input name="code" placeholder="CHN-SUMMER-2026" required />
              </label>
              <label>
                Публичный slug
                <input name="public_slug" placeholder="china-tech-immersion" required />
              </label>
              <label>
                Название
                <input name="title" placeholder="Китай: язык и технологии" required />
              </label>
              <label>
                Страна
                <input name="country" placeholder="Китай" required />
              </label>
              <label>
                Город
                <input name="city" placeholder="Сиань" />
              </label>
              <label>
                Сегмент
                <select name="segment" defaultValue="teen">
                  {segmentOptions.map((segment) => (
                    <option key={segment} value={segment}>{label('segment', segment)}</option>
                  ))}
                </select>
              </label>
              <label>
                Тип поездки
                <select name="trip_type" defaultValue="language-immersion">
                  {tripTypeOptions.map((type) => (
                    <option key={type} value={type}>{label('tripType', type)}</option>
                  ))}
                </select>
              </label>
              <label>
                Язык
                <input name="language" placeholder="Китайский" />
              </label>
              <label>
                Длительность, дней
                <input name="duration_days" type="number" min="1" defaultValue="14" />
              </label>
            </div>
            <label>
              Краткое описание
              <textarea name="short_description" placeholder="2 недели языка, кампус, компании, практика" />
            </label>
            <label>
              Полное описание
              <textarea name="description" placeholder="Полная программа, безопасность, формат проживания, экскурсии" />
            </label>
            <div className="form-actions">
              <button className="button">Создать программу</button>
            </div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Продуктовые правила</h2>
          <ul className="list">
            <li>Каждая программа — отдельный продукт с кодом, slug и сегментом.</li>
            <li>Продажа не должна зависеть от устных объяснений основателя.</li>
            <li>Оффер и программа должны быть читаемы на сайте без менеджера-переводчика.</li>
          </ul>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Каталог программ</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Программа</th>
                <th>Сегмент</th>
                <th>Формат</th>
                <th>Локация</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((program) => (
                <tr key={program.id}>
                  <td>
                    <div>{program.title}</div>
                    <div className="micro">{program.code} · /programs/{program.public_slug}</div>
                  </td>
                  <td>{label('segment', program.segment)}</td>
                  <td>{label('tripType', program.trip_type)}</td>
                  <td>{[program.country, program.city].filter(Boolean).join(', ')}</td>
                  <td>{program.is_active ? 'Активна' : 'Неактивна'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
