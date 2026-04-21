'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'

export type DealRegistryRow = {
  id: string
  title: string
  stage: string
  estimated_value: number | null
  currency: string | null
  participants_count: number | null
  created_at: string
  lead?: {
    contact_name_raw?: string | null
    phone_raw?: string | null
    email_raw?: string | null
    desired_country?: string | null
    desired_program?: { title?: string | null } | null
    desired_departure?: { departure_name?: string | null } | null
  } | null
  owner?: { full_name?: string | null; email?: string | null } | null
  account?: { display_name?: string | null } | null
  program?: { title?: string | null } | null
  departure?: { departure_name?: string | null } | null
}

export function DealRegistryTable({
  deals,
  openDealId,
}: {
  deals: DealRegistryRow[]
  openDealId?: string
}) {
  const router = useRouter()

  return (
    <div className="table-wrap table-wrap--compact-view">
      <table className="table compact-table deal-table">
        <thead>
          <tr>
            <th>Сделка</th>
            <th>Контакт и выбор лида</th>
            <th>Менеджер / стадия</th>
            <th>Сумма</th>
            <th>Создана</th>
            <th>Переход</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr
              key={deal.id}
              className={`interactive-row ${openDealId === deal.id ? 'is-open-row' : ''}`}
              onClick={() => router.push(`/dashboard/deals?open=${deal.id}#deal-editor`)}
            >
              <td>
                <div><strong>{deal.title}</strong></div>
                <div className="micro">{deal.lead?.contact_name_raw || deal.account?.display_name || 'Без клиента'}</div>
              </td>
              <td>
                <div>{deal.lead?.phone_raw || deal.lead?.email_raw || 'Контакты не заполнены'}</div>
                <div className="micro">{deal.lead?.desired_program?.title || deal.program?.title || deal.lead?.desired_country || 'Интерес не выбран'}</div>
                <div className="micro">{deal.lead?.desired_departure?.departure_name || deal.departure?.departure_name || 'Выезд не выбран'}</div>
              </td>
              <td>
                <div>{deal.owner?.full_name || deal.owner?.email || 'Не назначен'}</div>
                <div className="micro">{label('dealStage', deal.stage)}</div>
              </td>
              <td>
                <div>{formatCurrency(deal.estimated_value, deal.currency || 'RUB')}</div>
                <div className="micro">Участников: {deal.participants_count || 1}</div>
              </td>
              <td>{formatDateTime(deal.created_at)}</td>
              <td>
                <div className="registry-actions registry-actions--inline" onClick={(e) => e.stopPropagation()}>
                  <Link className="button-secondary" href={`/dashboard/deals?open=${deal.id}#deal-editor`}>Открыть / править</Link>
                  <Link className="button-secondary" href={`/dashboard/finance?deal_id=${deal.id}`}>К финансам</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
