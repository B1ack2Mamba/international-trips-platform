import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <main className="container section">
      <div className="card stack">
        <div className="badge warning">Доступ ограничен</div>
        <h1 className="page-title">У этого аккаунта недостаточно прав</h1>
        <p className="muted">
          В текущем MVP внутренний кабинет рассчитан на роли owner, admin, sales, ops и finance.
        </p>
        <div className="form-actions">
          <Link className="button" href="/login">
            Сменить аккаунт
          </Link>
          <Link className="button-secondary" href="/">
            На главную
          </Link>
        </div>
      </div>
    </main>
  )
}
