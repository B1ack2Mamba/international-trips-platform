import Link from 'next/link'
import type { WorkspaceLink, WorkspaceSpace } from '@/lib/influence-spaces'

function tint(hex: string, alpha: string) {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return `rgba(125, 211, 252, ${alpha})`
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function InfluenceMap({
  spaces,
  globalLinks = [],
  title = 'Пространства влияния',
  text = 'Каждое пространство собирает свой набор разделов и свою схему переходов.',
  compact = false,
}: {
  spaces: WorkspaceSpace[]
  globalLinks?: WorkspaceLink[]
  title?: string
  text?: string
  compact?: boolean
}) {
  if (!spaces.length) {
    return null
  }

  return (
    <section className="card stack">
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p className="micro" style={{ marginTop: 6 }}>{text}</p>
      </div>

      <div className={`influence-grid${compact ? ' compact' : ''}`}>
        {spaces.map((space) => (
          <article
            key={space.id}
            className="influence-space"
            style={{
              borderColor: tint(space.color, '0.55'),
              background: `linear-gradient(180deg, ${tint(space.color, '0.18')}, ${tint(space.color, '0.07')})`,
              boxShadow: `0 0 0 1px ${tint(space.color, '0.2')}`,
            }}
          >
            <div className="influence-space-head">
              <div>
                <div className="influence-space-title">{space.name}</div>
                <div className="micro">{space.description || 'Без описания'}</div>
              </div>
              <div className="badge-row">
                <span className="badge">{space.modules.length} блоков</span>
                <span className="badge">{space.members.length} участ.</span>
              </div>
            </div>

            <div className="influence-space-modules">
              {space.modules.map((item) => (
                <Link key={item.id} href={item.module.href} className="influence-module">
                  <span>{item.module.label}</span>
                </Link>
              ))}
            </div>

            {space.links.length ? (
              <div className="influence-links">
                {space.links.map((link) => (
                  <div key={link.id} className="influence-link-row">
                    <span className="micro">{link.from.label}</span>
                    <span className="influence-link-arrow">→</span>
                    <span className="micro">{link.to.label}</span>
                    {link.label ? <span className="badge">{link.label}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {globalLinks.length ? (
        <div className="stack" style={{ gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Общие связи</div>
          <div className="badge-row">
            {globalLinks.map((link) => (
              <span key={link.id} className="badge">
                {link.from.label} → {link.to.label}
                {link.label ? ` · ${link.label}` : ''}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
