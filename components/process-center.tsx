import Link from 'next/link'

type FlowLink = {
  href: string
  title: string
  note: string
}

type FlowRow = {
  main: FlowLink
  left?: FlowLink[]
  right?: FlowLink[]
}

const rows: FlowRow[] = [
  {
    main: { href: '/dashboard/leads', title: 'Лиды', note: 'вход' },
    left: [{ href: '/dashboard/partners', title: 'Партнёры', note: 'ист.' }],
    right: [{ href: '/dashboard/scripts', title: 'Скрипты', note: 'дожим' }],
  },
  {
    main: { href: '/dashboard/deals', title: 'Сделки', note: 'прод.' },
    left: [
      { href: '/dashboard/accounts', title: 'Акк.', note: 'клиент' },
      { href: '/dashboard/partners', title: 'Партн.', note: 'канал' },
    ],
    right: [
      { href: '/dashboard/programs', title: 'Прогр.', note: 'продукт' },
      { href: '/dashboard/departures', title: 'Выезды', note: 'даты' },
    ],
  },
  {
    main: { href: '/dashboard/finance', title: 'Финансы', note: 'деньги' },
    left: [
      { href: '/dashboard/departures', title: 'Выезды', note: 'привяз.' },
      { href: '/dashboard/contracts', title: 'Договоры', note: 'осн.' },
    ],
    right: [
      { href: '/dashboard/finance?create=payment', title: 'Платёж', note: 'счёт' },
      { href: '/dashboard/controlling', title: 'Маржа', note: 'далее' },
    ],
  },
  {
    main: { href: '/dashboard/controlling', title: 'Контролл.', note: 'P&L' },
    left: [{ href: '/dashboard/departures', title: 'Выезды', note: 'COGS' }],
    right: [{ href: '/dashboard/reports', title: 'Отчёты', note: 'итог' }],
  },
]

const quickLinks: FlowLink[] = [
  { href: '/dashboard/leads', title: '+ Лид', note: 'ручн.' },
  { href: '/dashboard/deals', title: '+ Сделка', note: 'из лида' },
  { href: '/dashboard/finance?create=payment', title: '+ Платёж', note: 'из сделки' },
  { href: '/dashboard/controlling?create=expense', title: '+ Расход', note: 'в P&L' },
]

function FlowNode({ node, mini = false }: { node: FlowLink; mini?: boolean }) {
  return (
    <Link
      href={node.href}
      className={`flow-node${mini ? ' mini' : ' main'}`}
      title={`${node.title} — открыть раздел`}
      aria-label={`${node.title} — открыть раздел`}
    >
      <span className="flow-node-title">{node.title}</span>
      <span className="flow-node-note">{node.note}</span>
    </Link>
  )
}

function Branch({ items, side }: { items?: FlowLink[]; side: 'left' | 'right' }) {
  if (!items?.length) return <div className={`flow-branch ${side}`} />

  return (
    <div className={`flow-branch ${side}`}>
      {items.map((item) => (
        <div key={`${item.href}-${item.title}`} className={`flow-branch-item ${side}`}>
          {side === 'right' ? <span className="flow-arrow side">→</span> : null}
          <FlowNode node={item} mini />
          {side === 'left' ? <span className="flow-arrow side">→</span> : null}
        </div>
      ))}
    </div>
  )
}

export function ProcessCenter() {
  return (
    <section className="card process-center-shell">
      <div className="process-center-head">
        <div className="badge-row" style={{ justifyContent: 'center' }}>
          <span className="badge success">Процесс</span>
          <span className="badge">центр</span>
        </div>
        <h2 style={{ margin: 0 }}>Поток сверху вниз</h2>
        <p className="micro" style={{ margin: 0 }}>Это рабочее меню: боковые узлы показывают нелинейные связи, а мини-кнопки снизу — быстрые входы для теста.</p>
      </div>

      <div className="flow-root">
        <div className="flow-root-badge">Старт</div>
        <div className="flow-arrow down">↓</div>
      </div>

      <div className="flow-map">
        {rows.map((row, index) => (
          <div key={`${row.main.href}-${index}`} className="flow-row">
            <Branch items={row.left} side="left" />

            <div className="flow-main-stack">
              <FlowNode node={row.main} />
              {index < rows.length - 1 ? <div className="flow-arrow down">↓</div> : null}
            </div>

            <Branch items={row.right} side="right" />
          </div>
        ))}
      </div>

      <div className="flow-shortcuts">
        {quickLinks.map((item) => (
          <FlowNode key={`${item.href}-${item.title}`} node={item} mini />
        ))}
      </div>
    </section>
  )
}
