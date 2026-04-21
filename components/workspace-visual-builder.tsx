'use client'

import { WorkspaceConstructor } from '@/components/workspace-constructor'
import type { WorkspaceBuilderData } from '@/lib/influence-spaces'

export function WorkspaceVisualBuilder({ initialData }: { initialData: WorkspaceBuilderData }) {
  return <WorkspaceConstructor initialData={initialData} />
}
