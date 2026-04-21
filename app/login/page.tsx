import Link from 'next/link'
import { login, signup } from './actions'

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
            Используйте рабочий email. Если этот email добавлен в зону доступа, после регистрации
            кабинет сразу откроет назначенные разделы.
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
                <input name="email" type="email" placeholder="name@company.com" required />
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
              <button className="button-secondary" formAction={signup}>
                Зарегистрироваться
              </button>
            </div>
          </form>
        </section>

        <section className="card stack">
          <h2 style={{ margin: 0 }}>Проверка доступа</h2>
          <ol className="list">
            <li>Добавьте email в поле участников нужной зоны доступа.</li>
            <li>Пользователь регистрируется этим же email на сайте.</li>
            <li>При первом входе профиль активируется и получает разделы из назначенной зоны.</li>
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
