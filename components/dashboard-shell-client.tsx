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
      <div className="dashboard-sidebar-wrap">
        <button
          type="button"
          className="dashboard-sidebar-toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Показать меню' : 'Скрыть меню'}
          title={collapsed ? 'Показать меню' : 'Скрыть меню'}
        >
          {collapsed ? '›' : '‹'}
        </button>
        {sidebar}
      </div>
      <section className="dashboard-main">
        {workbar ? (
          <div className="dashboard-workbar">
            <div className="dashboard-workbar-extra">{workbar}</div>
          </div>
        ) : null}
        <div className="content-stack">{children}</div>
      </section>
    </div>
  )
}
