import { requireDashboardAccess } from '@/lib/auth'
import { updateProfile } from './actions'
import { getRoleAbilityMatrixRows, getRoleMatrixRows } from '@/lib/roles'
import { label } from '@/lib/labels'

export default async function SettingsPage() {
  const { profile } = await requireDashboardAccess('/dashboard/settings')
  const roleMatrix = getRoleMatrixRows()
  const abilityMatrix = getRoleAbilityMatrixRows()

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Настройки</h1>
          <p className="muted">Здесь лежат не только личные поля, но и карта ответственности по должностям, чтобы система не превращалась в общий сарай.</p>
        </div>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Профиль</h2>
          <div className="badge-row">
            <span className="badge success">Текущая роль: {label('role', profile?.role)}</span>
          </div>
          <form action={updateProfile}>
            <div className="form-grid">
              <label>
                ФИО
                <input name="full_name" defaultValue={profile?.full_name ?? ''} />
              </label>
              <label>
                Телефон
                <input name="phone" defaultValue={profile?.phone ?? ''} />
              </label>
              <label>
                Locale
                <input name="locale" defaultValue={profile?.locale ?? 'ru'} />
              </label>
              <label>
                Timezone
                <input name="timezone" defaultValue={profile?.timezone ?? 'Europe/Moscow'} />
              </label>
            </div>
            <div className="form-actions">
              <button className="button">Сохранить профиль</button>
            </div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Что лежит в этом контуре</h2>
          <ul className="list">
            <li>роли и видимость рабочих зон по должностям;</li>
            <li>уведомления Telegram / email / WhatsApp;</li>
            <li>ключи интеграций;</li>
            <li>каналы захвата и UTM-логика;</li>
            <li>правила доступа к финансам, контроллингу и операционке;</li>
            <li>пространства влияния: какие разделы, связи и люди собраны в одном контуре.</li>
          </ul>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Матрица должностей и функций</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Должность</th>
                <th>Зона ответственности</th>
                <th>Разделы</th>
              </tr>
            </thead>
            <tbody>
              {roleMatrix.map((row) => (
                <tr key={row.role}>
                  <td>{label('role', row.role)}</td>
                  <td>
                    <div>{row.zone.title}</div>
                    <div className="micro">{row.zone.subtitle}</div>
                  </td>
                  <td>
                    <div className="stack" style={{ gap: 8 }}>
                      {row.groups.map((group) => (
                        <div key={`${row.role}-${group.title}`}>
                          <div className="micro">{group.title}</div>
                          <div>{group.items.join(' · ')}</div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Матрица действий по ролям</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Должность</th>
                <th>Зона</th>
                <th>Разрешённые действия</th>
              </tr>
            </thead>
            <tbody>
              {abilityMatrix.map((row) => (
                <tr key={`ability-${row.role}`}>
                  <td>{label('role', row.role)}</td>
                  <td>
                    <div>{row.zone.title}</div>
                    <div className="micro">{row.zone.subtitle}</div>
                  </td>
                  <td>
                    <div className="stack" style={{ gap: 8 }}>
                      {row.groups.map((group) => (
                        <div key={`ability-${row.role}-${group.title}`}>
                          <div className="micro">{group.title}</div>
                          <div>{group.items.join(' · ')}</div>
                        </div>
                      ))}
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
