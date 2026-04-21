import Link from 'next/link'

const systemNodes = [
  {
    title: 'Мозг',
    text: 'Кабинет руководителя, KPI, роли, контроль качества и маршрутизация решений.',
  },
  {
    title: 'Двигатель',
    text: 'Лидогенерация, продажи, скрипты, follow-up, SLA на ответы и конверсия в заявки.',
  },
  {
    title: 'Коробка передач',
    text: 'Сделки, заявки, оплаты, дедлайны, документы и handoff от продаж в операционку.',
  },
  {
    title: 'Колёса',
    text: 'Программы, выезды, группы, участники, партнёры, логистика и выездная реализация.',
  },
  {
    title: 'Тормоза',
    text: 'RLS, роли, анти-переманивание, единый клиентский контур и обязательные поля.',
  },
  {
    title: 'Радар',
    text: 'Сайт, Telegram, партнёры, школы, контекст, реферальные каналы, webhooks и формы.',
  },
]

export default function HomePage() {
  return (
    <main>
      <section className="hero container">
        <div className="hero-grid">
          <div className="hero-card stack">
            <div className="badge-row">
              <span className="badge success">Готово для Vercel</span>
              <span className="badge success">Готово для Supabase</span>
              <span className="badge">CRM + портал + операционка</span>
            </div>
            <h1>Платформа, которая перестаёт быть человеком-оркестром.</h1>
            <p className="lead">
              Это стартовый каркас для проекта международных поездок: единый сайт, intake лидов,
              продажная CRM, операционный контур выездов, заявки, оплаты и скрипты.
            </p>
            <div className="form-actions">
              <Link className="button" href="/programs">
                Открыть публичный портал
              </Link>
              <Link className="button-secondary" href="/dashboard">
                Перейти в кабинет
              </Link>
            </div>
          </div>
          <div className="hero-card stack">
            <h2 style={{ margin: 0 }}>Что уже собрано в MVP</h2>
            <ul className="list">
              <li>Публичный каталог программ и страница каждой программы</li>
              <li>Форма захвата лида напрямую в Supabase</li>
              <li>Кабинет руководителя и базовые CRM-модули</li>
              <li>Миграции БД, роли, RLS и стартовые данные</li>
              <li>Каркас для Edge Functions и webhook-интеграций</li>
            </ul>
            <div className="notice">
              Система не пытается заменить стратегию. Она убирает ручной хаос, чтобы стратегия не
              тонула в WhatsApp, Excel и чужих посредниках.
            </div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <div>
            <h2 className="page-title">Узлы машины</h2>
            <p className="muted">Вид с уровня архитектора: где мозг, где двигатель, где колёса.</p>
          </div>
        </div>
        <div className="grid-3">
          {systemNodes.map((node) => (
            <article key={node.title} className="card stack">
              <h3 style={{ margin: 0 }}>{node.title}</h3>
              <p className="muted" style={{ margin: 0 }}>
                {node.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="grid-2">
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Какая логика потока уже учтена</h2>
            <ul className="list">
              <li>Источник трафика → лид → квалификация → сделка → заявка → оплата → выезд</li>
              <li>Роли разделены: руководитель, продажи, операционка, финансы</li>
              <li>Публичный портал и внутренняя CRM работают на одном ядре данных</li>
              <li>Партнёрский канал учитывается отдельно, но клиент остаётся в вашей системе</li>
            </ul>
          </div>
          <div className="card stack">
            <h2 style={{ margin: 0 }}>Следующий прагматичный шаг</h2>
            <p className="muted" style={{ margin: 0 }}>
              Развернуть Supabase, заполнить env, применить миграции, назначить owner-пользователя
              и начать гонять живые лиды через платформу уже на этой неделе.
            </p>
            <div className="form-actions">
              <Link className="button" href="/login">
                Войти и проверить кабинет
              </Link>
              <Link className="button-secondary" href="/programs">
                Протестировать публичную форму
              </Link>
            </div>
          </div>
        </div>
      </section>
      <div className="footer-space" />
    </main>
  )
}
