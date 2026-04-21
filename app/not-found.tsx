import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="container section">
      <div className="card stack">
        <div className="badge warning">404</div>
        <h1 className="page-title">Страница не найдена</h1>
        <p className="muted">Возможно, slug ещё не создан или программа выключена.</p>
        <div className="form-actions">
          <Link className="button" href="/programs">
            Каталог программ
          </Link>
        </div>
      </div>
    </main>
  )
}
