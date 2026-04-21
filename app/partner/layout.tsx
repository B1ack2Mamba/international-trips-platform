import Link from 'next/link'
import { requirePartner } from '@/lib/auth'
import { label } from '@/lib/labels'

export const dynamic = 'force-dynamic'

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requirePartner()

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-kicker">Партнёрский кабинет</div>
          <div className="brand-title">{profile?.full_name || 'Партнёр'}</div>
          <div className="brand-subtitle">{label('role', profile?.role)}</div>
        </div>
        <nav className="nav-list">
          <Link href="/partner">Обзор</Link>
          <Link href="/programs">Публичный каталог</Link>
        </nav>
      </aside>
      <main className="dashboard-content">{children}</main>
    </div>
  )
}
