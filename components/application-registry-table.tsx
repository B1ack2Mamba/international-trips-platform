'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'

export type ApplicationRegistryRow = {
  id: string
  participant_name: string
  guardian_name?: string | null
  guardian_phone?: string | null
  guardian_email?: string | null
  status: string
  visa_status: string
  contract_status: string
  documents_ready?: boolean | null
  amount_paid?: number | null
  amount_total?: number | null
  payment_status: string
  created_at: string
  deal?: { id: string; title: string } | null
  departure?: { id: string; departure_name: string } | null
}

export function ApplicationRegistryTable({ applications }: { applications: ApplicationRegistryRow[] }) {
  const router = useRouter()
  return (
    <div className="table-wrap table-wrap--compact-view applications-table-wrap">
      <table className="table compact-table applications-table applications-table--dense">
        <thead>
          <tr>
            <th>Участник</th>
            <th>Сделка / выезд</th>
            <th>Опекун</th>
            <th>Статусы</th>
            <th>Финансы</th>
            <th>Создана</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.id} className="interactive-row" onClick={() => router.push(`/dashboard/applications/${application.id}`)}>
              <td>
                <div><strong>{application.participant_name}</strong></div>
                <div className="micro">Карточка участника</div>
              </td>
              <td>
                <div>{application.deal?.title || '—'}</div>
                <div className="micro">{application.departure?.departure_name || 'Выезд не назначен'}</div>
              </td>
              <td>
                <div>{application.guardian_name || '—'}</div>
                <div className="micro">{application.guardian_phone || application.guardian_email || '—'}</div>
              </td>
              <td>
                <div>{label('applicationStatus', application.status)}</div>
                <div className="micro">Виза: {label('visaStatus', application.visa_status)}</div>
                <div className="micro">Договор: {label('contractStatus', application.contract_status)}</div>
                <div className="micro">Документы: {application.documents_ready ? 'готовы' : 'в работе'}</div>
              </td>
              <td>
                <div>{formatCurrency(application.amount_paid || 0)} / {formatCurrency(application.amount_total || 0)}</div>
                <div className="micro">Оплата: {label('paymentStatus', application.payment_status)}</div>
              </td>
              <td>{formatDateTime(application.created_at)}</td>
              <td>
                <div className="registry-actions registry-actions--applications-row" onClick={(e) => e.stopPropagation()}>
                  <Link className="button-secondary" href={`/dashboard/applications/${application.id}`}>Карточка</Link>
                  <Link className="button-secondary" href={`/dashboard/contracts?application_id=${application.id}`}>Договоры</Link>
                  <Link className="button-secondary" href={`/dashboard/finance?application_id=${application.id}`}>Платежи</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
