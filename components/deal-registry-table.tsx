'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import type { DealFlowSummary } from '@/lib/queries'

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
  flowByDealId = {},
}: {
  deals: DealRegistryRow[]
  openDealId?: string
  flowByDealId?: Record<string, DealFlowSummary>
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
            <th>Договор / оплата</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const flow = flowByDealId[deal.id]
            const paid = Boolean(flow?.payment_amount && flow.payment_paid_amount >= flow.payment_amount)
            const partiallyPaid = Boolean(!paid && flow?.payment_paid_amount)
            const nextStep = !flow?.contract_id
              ? 'Нужен договор'
              : flow.contract_status !== 'signed'
                ? 'Ждём подпись'
                : !paid
                  ? partiallyPaid ? 'Доплата' : 'Ждём оплату'
                  : flow.application_id ? 'В участниках' : 'Создать участника'
            return (
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
                {flow ? <div className={`micro ${paid ? 'success-text' : ''}`}>{paid ? 'Оплачено' : partiallyPaid ? 'Частично оплачено' : 'Ожидает оплаты'} · {formatCurrency(flow.payment_paid_amount, deal.currency || 'RUB')}</div> : null}
                <div className="micro">Следующий шаг: {nextStep}</div>
              </td>
              <td>{formatDateTime(deal.created_at)}</td>
              <td>
                <div className="registry-actions registry-actions--inline" onClick={(e) => e.stopPropagation()}>
                  <Link className="button-secondary" href={`/dashboard/contracts?deal_id=${deal.id}`}>{flow?.contract_status ? label('contractStatus', flow.contract_status) : 'Договор'}</Link>
                  <Link className="button-secondary" href={`/dashboard/deals?open=${deal.id}&pay=1#deal-payment-popover`}>Оплата</Link>
                  {flow?.application_id ? <Link className="button-secondary" href={`/dashboard/participants?deal_id=${deal.id}`}>Участник</Link> : null}
                </div>
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
