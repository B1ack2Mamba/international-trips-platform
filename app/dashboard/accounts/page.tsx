import Link from 'next/link'
import { createAccount, createAccountContact, updateAccountStatus } from './actions'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { label, accountTypeOptions } from '@/lib/labels'
import { getAccountById, getAccounts, getContactsByAccount, getDealsByAccount } from '@/lib/queries'

export default async function AccountsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const openAccountId = typeof params.open === 'string' ? params.open : ''
  const [accounts, openAccount, contacts, deals] = await Promise.all([
    getAccounts(80),
    openAccountId ? getAccountById(openAccountId) : Promise.resolve(null),
    openAccountId ? getContactsByAccount(openAccountId, 30) : Promise.resolve([]),
    openAccountId ? getDealsByAccount(openAccountId, 20) : Promise.resolve([]),
  ])

  return (
    <div className="content-stack compact-page fullscreen-stretch">
      <section className="section-head">
        <div>
          <h1 className="page-title">Клиенты</h1>
          <p className="muted">Единый реестр семей, школ, компаний и партнёров с контактами и связанными сделками.</p>
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

      <div className={`account-workspace ${openAccount ? 'is-open' : ''}`}>
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Реестр клиентов</h2>
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
                    <td>
                      <Link href={`/dashboard/accounts?open=${account.id}#account-card`}>
                        {account.display_name}
                      </Link>
                    </td>
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

        {openAccount ? (
        <aside id="account-card" className="card stack deal-editor-drawer">
          <div className="deal-editor-head">
            <div>
              <div className="micro">{label('accountType', openAccount.account_type)} · {label('accountStatus', openAccount.status)}</div>
              <h2>{openAccount.display_name}</h2>
            </div>
            <Link className="button-secondary" href="/dashboard/accounts">Закрыть</Link>
          </div>

          <div className="detail-grid">
            <div><div className="micro">Локация</div><div>{[openAccount.city, openAccount.country].filter(Boolean).join(', ') || 'Не указана'}</div></div>
            <div><div className="micro">Сайт</div><div>{openAccount.website_url ? <a href={openAccount.website_url}>{openAccount.website_url}</a> : 'Не указан'}</div></div>
            <div><div className="micro">Создан</div><div>{formatDateTime(openAccount.created_at)}</div></div>
            <div><div className="micro">Сделок</div><div>{deals.length}</div></div>
          </div>

          {openAccount.notes ? <p className="muted">{openAccount.notes}</p> : null}

          <form action={updateAccountStatus} className="compact-form-grid compact-form-grid--account-status">
            <input type="hidden" name="account_id" value={openAccount.id} />
            <label>
              Статус клиента
              <select name="status" defaultValue={openAccount.status}>
                <option value="active">Активен</option>
                <option value="inactive">Неактивен</option>
                <option value="archived">Архив</option>
              </select>
            </label>
            <div className="form-actions"><button className="button-secondary">Обновить</button></div>
          </form>

          <section className="stack">
            <div className="deal-editor-head">
              <h3>Контакты</h3>
              <span className="badge">{contacts.length}</span>
            </div>
            <div className="mini-list">
              {contacts.map((contact) => (
                <div key={contact.id} className="mini-list-row">
                  <div>
                    <strong>{[contact.first_name, contact.last_name].filter(Boolean).join(' ')}</strong>
                    <div className="micro">{[contact.role_label, contact.phone, contact.email, contact.telegram_username].filter(Boolean).join(' · ') || 'Контактные данные не заполнены'}</div>
                  </div>
                  {contact.is_primary ? <span className="badge success">Основной</span> : null}
                </div>
              ))}
              {!contacts.length ? <div className="empty-state">Контактов пока нет.</div> : null}
            </div>

            <form action={createAccountContact} className="compact-form-grid compact-form-grid--account-contact">
              <input type="hidden" name="account_id" value={openAccount.id} />
              <label>Имя<input name="first_name" placeholder="Анна" required /></label>
              <label>Фамилия<input name="last_name" placeholder="Иванова" /></label>
              <label>Роль<input name="role_label" placeholder="Родитель / директор / партнёр" /></label>
              <label>Телефон<input name="phone" placeholder="+7..." /></label>
              <label>Email<input name="email" type="email" placeholder="client@example.com" /></label>
              <label>Telegram<input name="telegram_username" placeholder="@username" /></label>
              <label className="checkbox-row"><input name="is_primary" type="checkbox" /> Основной контакт</label>
              <label className="account-contact-notes">Заметки<textarea name="notes" placeholder="Предпочтения, кто принимает решение, как лучше связываться" /></label>
              <div className="form-actions"><button className="button-secondary">Добавить контакт</button></div>
            </form>
          </section>

          <section className="stack">
            <div className="deal-editor-head">
              <h3>Связанные сделки</h3>
              <span className="badge">{deals.length}</span>
            </div>
            <div className="mini-list">
              {deals.map((deal) => (
                <Link key={deal.id} className="mini-list-row mini-list-row--link" href={`/dashboard/deals?open=${deal.id}#deal-editor`}>
                  <div>
                    <strong>{deal.title}</strong>
                    <div className="micro">{label('dealStage', deal.stage)} · {deal.program?.title || deal.lead?.desired_country || 'Программа не указана'}</div>
                  </div>
                  <span className="badge">{formatCurrency(deal.estimated_value, deal.currency)}</span>
                </Link>
              ))}
              {!deals.length ? <div className="empty-state">Сделок по клиенту пока нет.</div> : null}
            </div>
          </section>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
