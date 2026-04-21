'use client'

import { useLayoutEffect, type ReactNode } from 'react'

export function BuilderStudioMode({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.body.classList.add('builder-mode')
    return () => {
      document.body.classList.remove('builder-mode')
    }
  }, [])

  return children
}
