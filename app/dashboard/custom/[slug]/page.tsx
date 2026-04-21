import { notFound } from 'next/navigation'
import { CustomModuleBuilder } from '@/components/custom-module-builder'
import { requireDashboardAccess } from '@/lib/auth'
import { getCustomWorkspaceModuleScreenBySlug } from '@/lib/influence-spaces'
import { isAdminRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export default async function CustomWorkspaceModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const path = `/dashboard/custom/${slug}`
  const context = await requireDashboardAccess(path)
  const module = await getCustomWorkspaceModuleScreenBySlug(slug, context.supabase)

  if (!module) {
    notFound()
  }

  return <CustomModuleBuilder module={module} canEdit={isAdminRole(context.profile?.role)} />
}
