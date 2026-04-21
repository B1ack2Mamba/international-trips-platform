import { createSalesScript } from './actions'
import { formatDateTime } from '@/lib/format'
import { label, segmentOptions } from '@/lib/labels'
import { getSalesScripts } from '@/lib/queries'

export default async function ScriptsPage() {
  const scripts = await getSalesScripts(40)

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Скрипты продаж</h1>
          <p className="muted">Продажа должна быть системой, а не случайной харизмой конкретного человека.</p>
        </div>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Новый скрипт</h2>
          <form action={createSalesScript}>
            <div className="form-grid">
              <label>
                Сегмент
                <select name="segment" defaultValue="teen">
                  {segmentOptions.map((segment) => (
                    <option key={segment} value={segment}>{label('segment', segment)}</option>
                  ))}
                </select>
              </label>
              <label>
                Этап
                <input name="stage" placeholder="Первичный звонок" required />
              </label>
            </div>
            <label>
              Название
              <input name="title" placeholder="Первичный звонок родителю" required />
            </label>
            <label>
              Текст скрипта
              <textarea name="body" placeholder="1. Выясняем цель поездки... 2. Калибруем страхи родителей..." required />
            </label>
            <div className="form-actions">
              <button className="button">Сохранить скрипт</button>
            </div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Что важно</h2>
          <ul className="list">
            <li>Скрипты должны зависеть от сегмента и этапа продажи.</li>
            <li>Нужно хранить не только оффер, но и ответы на ключевые возражения.</li>
            <li>Любой новый менеджер должен включаться в систему, а не изобретать свой стиль с нуля.</li>
          </ul>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>База скриптов</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Сегмент</th>
                <th>Этап</th>
                <th>Текст</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((script) => (
                <tr key={script.id}>
                  <td>{script.title}</td>
                  <td>{label('segment', script.segment)}</td>
                  <td>{script.stage}</td>
                  <td style={{ maxWidth: 420 }}>{script.body}</td>
                  <td>{formatDateTime(script.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
