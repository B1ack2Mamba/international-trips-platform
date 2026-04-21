import { requireStaff } from '@/lib/auth'
import { Sidebar } from '@/components/sidebar'
import { DashboardShellClient } from '@/components/dashboard-shell-client'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff()

  return (
    <main className="container">
      <DashboardShellClient sidebar={<Sidebar profile={profile!} />}>{children}</DashboardShellClient>
    </main>
  )
}
