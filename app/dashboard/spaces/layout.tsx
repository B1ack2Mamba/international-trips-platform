import type { ReactNode } from 'react'
import { BuilderStudioMode } from '@/components/builder-studio-mode'

export default function SpacesBuilderLayout({ children }: { children: ReactNode }) {
  return <BuilderStudioMode>{children}</BuilderStudioMode>
}
