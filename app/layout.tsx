import './globals.css'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getSiteUrl } from '@/lib/env'

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'International Trips Platform',
  description: 'Платформа для международных языковых поездок, CRM и операционного управления.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <header className="topbar">
          <div className="container topbar-inner">
            <Link href="/" className="brand">
              <span className="brand-title">International Trips Platform</span>
              <span className="brand-subtitle">Мозг · двигатель · колёса одной системы</span>
            </Link>
            <nav className="nav-inline">
              <Link className="nav-chip" href="/programs">
                Программы
              </Link>
              <Link className="nav-chip" href="/dashboard">
                Кабинет
              </Link>
              <Link className="button" href="/login">
                Войти
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}
