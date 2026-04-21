import { createAccount } from './actions'
import { formatDateTime } from '@/lib/format'
import { label, accountTypeOptions } from '@/lib/labels'
import { getAccounts } from '@/lib/queries'

export default async function AccountsPage() {
  const accounts = await getAccounts(40)

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Аккаунты</h1>
          <p className="muted">Семьи, школы, компании и партнёры должны жить в одном реестре.</p>
        </div>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Новый аккаунт</h2>
          <form action={createAccount}>
            <div className="form-grid">
              <label>
                Название
                <input name="display_name" placeholder="Семья Ивановых" required />
              </label>
              <label>
                Тип
                <select name="account_type" defaultValue="family">
                  {accountTypeOptions.map((type) => (
                    <option key={type} value={type}>{label('accountType', type)}</option>
                  ))}
                </select>
              </label>
              <label>
                Город
                <input name="city" placeholder="Пенза" />
              </label>
              <label>
                Страна
                <input name="country" placeholder="Россия" />
              </label>
              <label>
                Сайт
                <input name="website_url" type="url" placeholder="https://partner.example.com" />
              </label>
            </div>
            <label>
              Заметки
              <textarea name="notes" placeholder="Ключевой партнёр или семейный аккаунт" />
            </label>
            <div className="form-actions">
              <button className="button">Сохранить аккаунт</button>
            </div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Почему без этого нельзя</h2>
          <ul className="list">
            <li>Клиент должен быть сущностью системы, а не конкретного менеджера.</li>
            <li>Партнёра нужно учитывать как канал и условия, а не как владельца семьи.</li>
            <li>Школы, семьи и бизнес-клиенты не должны лежать в разных блокнотах.</li>
          </ul>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Реестр аккаунтов</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Тип</th>
                <th>Локация</th>
                <th>Статус</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.display_name}</td>
                  <td>{label('accountType', account.account_type)}</td>
                  <td>{[account.city, account.country].filter(Boolean).join(', ') || '—'}</td>
                  <td>{label('accountStatus', account.status)}</td>
                  <td>{formatDateTime(account.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
