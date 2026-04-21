'use client'

import { formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { Fragment, useRef } from 'react'
import type { ReactNode } from 'react'

export type LeadRegistryRow = {
  id: string
  contact_name_raw?: string | null
  phone_raw?: string | null
  email_raw?: string | null
  desired_country?: string | null
  source_channel: string
  source_detail?: string | null
  status: string
  owner_user_id?: string | null
  created_at: string
  message?: string | null
  converted_deal_id?: string | null
  desired_program?: { title?: string | null } | null
  desired_departure?: { departure_name?: string | null } | null
  owner?: { full_name?: string | null } | null
}

function StatusForm({ leadId, currentStatus, updateAction }: { leadId: string; currentStatus: string; updateAction: (formData: FormData) => void }) {
  const ref = useRef<HTMLFormElement>(null)
  return (
    <form ref={ref} action={updateAction} onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="lead_id" value={leadId} />
      <input type="hidden" name="note" value="" />
      <select
        name="status"
        defaultValue={currentStatus}
        className="dense-inline-select"
        onChange={() => ref.current?.requestSubmit()}
      >
        <option value="new">Новый</option>
        <option value="in_progress">Взять в работу</option>
        <option value="archived">Архив</option>
      </select>
    </form>
  )
}

function leadDisplayStatus(lead: LeadRegistryRow) {
  if (lead.converted_deal_id) return 'Сделка'
  if (['archived', 'duplicate', 'disqualified'].includes(lead.status)) return 'Архив'
  if (lead.owner_user_id || lead.owner?.full_name) return 'В работе'
  return 'Новый'
}

export function LeadRegistryTable({
  leads,
  updateStatusAction,
  openBasePath = '/dashboard/leads',
  statusEditable = true,
  selectedLeadId = '',
  expandedRow,
}: {
  leads: LeadRegistryRow[]
  updateStatusAction: (formData: FormData) => void
  openBasePath?: string
  statusEditable?: boolean
  selectedLeadId?: string
  expandedRow?: ReactNode
}) {
  return (
    <div className="table-wrap table-wrap--compact-view leads-table-wrap">
      <table className="table compact-table lead-table lead-table--dense">
        <thead>
          <tr>
            <th>Контакт</th>
            <th>Интерес / выбор</th>
            <th>Канал</th>
            <th>Статус / менеджер</th>
            <th>Создан</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <Fragment key={lead.id}>
              <tr className={`interactive-row ${selectedLeadId === lead.id ? 'is-open-row' : ''}`} onClick={() => { window.location.href = `${openBasePath}?open=${lead.id}` }}>
                <td>
                  <div><strong>{lead.contact_name_raw || 'Без имени'}</strong></div>
                  <div className="micro">{lead.phone_raw || 'Телефон не указан'}</div>
                  <div className="micro">{lead.email_raw || 'Email не указан'}</div>
                </td>
                <td>
                  <div>{lead.desired_program?.title || lead.desired_country || 'Интерес не выбран'}</div>
                  <div className="micro">{lead.desired_departure?.departure_name || 'Выезд не выбран'}</div>
                  {lead.message ? <div className="micro lead-table-note">{lead.message}</div> : null}
                </td>
                <td>
                  <div>{label('channel', lead.source_channel)}</div>
                  <div className="micro">{lead.source_detail || '—'}</div>
                </td>
                <td>
                  {statusEditable ? (
                    <StatusForm leadId={lead.id} currentStatus={lead.status} updateAction={updateStatusAction} />
                  ) : (
                    <div>{leadDisplayStatus(lead)}</div>
                  )}
                  <div className="micro" style={{ marginTop: 6 }}>{lead.owner?.full_name || 'Не назначен'}</div>
                  {lead.converted_deal_id ? <div className="micro success-text">Сделка уже создана</div> : null}
                </td>
                <td>
                  <div>{formatDateTime(lead.created_at)}</div>
                </td>
              </tr>
              {selectedLeadId === lead.id && expandedRow ? (
                <tr className="lead-expanded-row">
                  <td colSpan={5}>{expandedRow}</td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
