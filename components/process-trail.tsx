import Link from 'next/link'

type ProcessTrailItem = {
  label: string
  href?: string
}

export function ProcessTrail({ items, current }: { items: ProcessTrailItem[]; current?: string }) {
  return (
    <div className="process-trail" aria-label="Связь блока в процессе">
      {items.map((item, index) => {
        const active = item.label === current
        const content = active ? (
          <span className={`process-trail-item${active ? ' active' : ''}`}>{item.label}</span>
        ) : item.href ? (
          <Link className="process-trail-item" href={item.href}>
            {item.label}
          </Link>
        ) : (
          <span className="process-trail-item">{item.label}</span>
        )

        return (
          <span key={`${item.label}-${index}`} style={{ display: 'contents' }}>
            {index > 0 ? <span className="process-trail-arrow">→</span> : null}
            {content}
          </span>
        )
      })}
    </div>
  )
}
