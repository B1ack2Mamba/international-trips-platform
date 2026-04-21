import Link from 'next/link'
import { getDashboardNavGroups } from '@/lib/roles'
import { label } from '@/lib/labels'
import { getDashboardNavGroupsForProfile, type WorkspaceNavGroup } from '@/lib/influence-spaces'

export async function Sidebar({
  profile,
}: {
  profile: { id: string; full_name: string | null; email: string | null; role: string | null }
}) {
  const baseGroups = getDashboardNavGroups(profile.role) as WorkspaceNavGroup[]
  const groups = (await Promise.race([
    getDashboardNavGroupsForProfile(profile),
    new Promise<WorkspaceNavGroup[]>((resolve) => setTimeout(() => resolve(baseGroups), 1200)),
  ])) as WorkspaceNavGroup[]
  return (
    <aside className="sidebar">
      <section className="sidebar-card stack">
        <div className="badge-row">
          <span className="badge success">{label('role', profile.role)}</span>
          <span className="badge">Разделов: {groups.reduce((sum, group) => sum + group.items.length, 0)}</span>
        </div>
        <div>
          <div style={{ fontWeight: 800 }}>{profile.full_name ?? 'Пользователь'}</div>
          <div className="micro">{profile.email ?? 'Без email'}</div>
        </div>
      </section>
      <section className="sidebar-card stack">
        {groups.map((group) => (
          <div key={group.title} className="stack" style={{ gap: 10 }}>
            <div className="micro sidebar-group-title">{group.title}</div>
            <nav>
              {group.items.map((item) => (
                <Link key={`${group.title}-${item.key}-${item.href}`} href={item.href} className="sidebar-link">
                  <div style={{ fontWeight: 700 }}>{item.label}</div>
                  <div className="micro">{item.description}</div>
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </section>
    </aside>
  )
}
