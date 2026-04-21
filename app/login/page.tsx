import Link from 'next/link'
import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const status = typeof params.status === 'string' ? params.status : ''
  const error = typeof params.error === 'string' ? params.error : ''

  return (
    <main className="container section">
      <div className="grid-2">
        <section className="card stack">
          <div className="badge-row">
            <span className="badge success">CRM доступ</span>
            <span className="badge">Админ-панель</span>
          </div>
          <h1 className="page-title">Вход в CRM</h1>
          <p className="muted" style={{ margin: 0 }}>
            Используйте рабочий email администратора или сотрудника с активной ролью в CRM.
          </p>
          {error ? <div className="notice notice-danger">{error}</div> : null}
          {status === 'signup' ? (
            <div className="notice">
              Аккаунт создан. Если у вас включено подтверждение почты, подтвердите email и войдите.
            </div>
          ) : null}
          <form>
            <div className="form-grid">
              <label>
                Email
                <input name="email" type="email" defaultValue="storyguild9@gmail.com" required />
              </label>
              <label>
                Пароль
                <input name="password" type="password" placeholder="Введите пароль" required />
              </label>
            </div>
            <div className="form-actions">
              <button className="button" formAction={login}>
                Войти
              </button>
            </div>
          </form>
        </section>

        <section className="card stack">
          <h2 style={{ margin: 0 }}>Проверка доступа</h2>
          <ol className="list">
            <li>Пользователь должен существовать в Supabase Auth.</li>
            <li>В <code>public.profiles</code> должна быть активная роль <code>owner</code>, <code>admin</code> или staff.</li>
            <li>После входа система ведёт сразу в рабочий обзор CRM.</li>
          </ol>
          <div className="form-actions">
            <Link className="button-secondary" href="/programs">
              Публичный каталог
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
