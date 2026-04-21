import { WorkspaceConstructor } from '@/components/workspace-constructor'
import { requireDashboardAccess } from '@/lib/auth'
import { getWorkspaceBuilderData } from '@/lib/influence-spaces'

export const dynamic = 'force-dynamic'

export default async function SpacesPage() {
  await requireDashboardAccess('/dashboard/spaces')
  const data = await getWorkspaceBuilderData()

  return <WorkspaceConstructor initialData={data} />
}
