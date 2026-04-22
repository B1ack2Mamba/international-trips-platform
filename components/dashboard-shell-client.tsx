'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'dashboard_shell_sidebar_collapsed_v1'

export function DashboardShellClient({
  sidebar,
  children,
  workbar,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
  workbar?: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved === '1') setCollapsed(true)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {}
  }, [collapsed])

  return (
    <div className={`dashboard-shell dashboard-shell--studio ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="dashboard-sidebar-wrap">{sidebar}</div>
      <section className="dashboard-main">
        <div className="dashboard-workbar">
          <button type="button" className="button-secondary" onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? 'Показать меню' : 'Скрыть меню'}
          </button>
          {workbar ? <div className="dashboard-workbar-extra">{workbar}</div> : null}
        </div>
        <div className="content-stack">{children}</div>
      </section>
    </div>
  )
}
