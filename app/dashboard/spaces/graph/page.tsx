import { WorkspaceConnectionsBuilder } from '@/components/workspace-connections-builder'
import { requireDashboardAccess } from '@/lib/auth'
import { getWorkspaceBuilderData } from '@/lib/influence-spaces'

export const dynamic = 'force-dynamic'

export default async function SpacesGraphPage() {
  await requireDashboardAccess('/dashboard/spaces')
  const data = await getWorkspaceBuilderData()

  return <WorkspaceConnectionsBuilder initialData={data} />
}
