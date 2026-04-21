import Link from 'next/link'

export default function HomePage() {
  return (
    <main>
      <section className="hero container">
        <div className="hero-grid">
          <div className="hero-card stack">
            <div className="badge-row">
              <span className="badge success">CRM активна</span>
              <span className="badge">International Trips</span>
            </div>
            <h1>Рабочий центр международных поездок</h1>
            <p className="lead">
              Лиды, сделки, заявки, оплаты, документы, выезды и партнёры в одном внутреннем контуре.
            </p>
            <div className="form-actions">
              <Link className="button" href="/dashboard">
                Открыть CRM
              </Link>
              <Link className="button-secondary" href="/programs">Каталог программ</Link>
            </div>
          </div>
          <div className="hero-card stack">
            <h2 style={{ margin: 0 }}>Быстрый маршрут</h2>
            <ul className="list">
              <li><Link href="/dashboard/leads">Лиды и первичный контакт</Link></li>
              <li><Link href="/dashboard/deals">Сделки и коммерческая воронка</Link></li>
              <li><Link href="/dashboard/ops">Операционка выездов</Link></li>
              <li><Link href="/dashboard/finance">Финансы и оплаты</Link></li>
            </ul>
            <div className="notice">
              Для входа используйте админский аккаунт с активной ролью в Supabase profiles.
            </div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <div>
            <h2 className="page-title">Основной CRM-поток</h2>
            <p className="muted">Один рабочий маршрут от заявки до поездки и оплаты.</p>
          </div>
        </div>
        <div className="grid-3">
          <Link href="/dashboard/leads" className="card stack">
            <h3 style={{ margin: 0 }}>1. Лид</h3>
            <p className="muted" style={{ margin: 0 }}>Заявка из сайта, партнёра или ручного ввода попадает в CRM.</p>
          </Link>
          <Link href="/dashboard/deals" className="card stack">
            <h3 style={{ margin: 0 }}>2. Сделка</h3>
            <p className="muted" style={{ margin: 0 }}>Менеджер квалифицирует клиента и ведёт коммерческий статус.</p>
          </Link>
          <Link href="/dashboard/applications" className="card stack">
            <h3 style={{ margin: 0 }}>3. Заявка</h3>
            <p className="muted" style={{ margin: 0 }}>После продажи запускаются документы, оплаты и операционный handoff.</p>
          </Link>
        </div>
      </section>
      <div className="footer-space" />
    </main>
  )
}
