'use client'

import { formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { useRef } from 'react'

export type LeadRegistryRow = {
  id: string
  contact_name_raw?: string | null
  phone_raw?: string | null
  email_raw?: string | null
  desired_country?: string | null
  source_channel: string
  source_detail?: string | null
  status: string
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
        <option value="in_progress">В работе</option>
        <option value="qualified">Готово</option>
      </select>
    </form>
  )
}

export function LeadRegistryTable({
  leads,
  updateStatusAction,
}: {
  leads: LeadRegistryRow[]
  updateStatusAction: (formData: FormData) => void
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
            <tr key={lead.id} className="interactive-row" onClick={() => { window.location.href = `/dashboard/leads?open=${lead.id}` }}>
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
                <StatusForm leadId={lead.id} currentStatus={lead.status} updateAction={updateStatusAction} />
                <div className="micro" style={{ marginTop: 6 }}>{lead.owner?.full_name || 'Не назначен'}</div>
                {lead.converted_deal_id ? <div className="micro success-text">Сделка уже создана</div> : null}
              </td>
              <td>
                <div>{formatDateTime(lead.created_at)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
