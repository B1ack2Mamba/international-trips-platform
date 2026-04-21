import Link from 'next/link'
import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const status = typeof params.status === 'string' ? params.status : ''

  return (
    <main className="container section">
      <div className="grid-2">
        <section className="card stack">
          <div className="badge-row">
            <span className="badge success">Авторизация</span>
            <span className="badge">Supabase SSR</span>
          </div>
          <h1 className="page-title">Вход в платформу</h1>
          <p className="muted" style={{ margin: 0 }}>
            Внутренний кабинет работает через модуль авторизации Supabase, а сессия обновляется серверным
            прокси-слоем.
          </p>
          {status === 'signup' ? (
            <div className="notice">
              Аккаунт создан. Если у вас включено подтверждение почты, подтвердите email и войдите.
            </div>
          ) : null}
          <form>
            <div className="form-grid">
              <label>
                Email
                <input name="email" type="email" placeholder="owner@example.com" required />
              </label>
              <label>
                Пароль
                <input name="password" type="password" placeholder="••••••••" required />
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
          <h2 style={{ margin: 0 }}>Что сделать после первого входа</h2>
          <ol className="list">
            <li>Назначить первой учётке роль <code>owner</code> в таблице <code>public.profiles</code>.</li>
            <li>Проверить стартовые данные: программы, выезды, скрипты и тестовые лиды.</li>
            <li>Открыть публичный каталог и отправить тестовую заявку самому себе.</li>
            <li>Убедиться, что лид появился в разделе «Лиды» и виден в CRM.</li>
          </ol>
          <div className="form-actions">
            <Link className="button-secondary" href="/programs">
              Протестировать публичный портал
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
