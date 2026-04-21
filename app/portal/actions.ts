'use server'

import { redirect } from 'next/navigation'
import { hasServiceRole } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPortalTokenAccess } from '@/lib/portal-auth'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function optionalValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  return raw || null
}

export async function acknowledgePortalContractAction(formData: FormData) {
  if (!hasServiceRole()) {
    redirect('/error?message=' + encodeURIComponent('SUPABASE_SERVICE_ROLE_KEY не задан. Публичный портал не может обновить договор.'))
  }

  const token = value(formData, 'token')
  const contractId = value(formData, 'contract_id')
  const signatoryName = optionalValue(formData, 'signatory_name')
  const signatoryEmail = optionalValue(formData, 'signatory_email')
  const note = optionalValue(formData, 'note')

  const access = await hasPortalTokenAccess(token)
  if (!access.ok || !access.application) {
    if (access.error === 'otp_required') {
      redirect(`/portal/access/${token}`)
    }
    redirect('/error?message=' + encodeURIComponent('Ссылка кабинета недействительна.'))
  }

  const admin = createAdminClient()
  const { data: contract } = await admin
    .from('contracts')
    .select('id, application_id, status, notes')
    .eq('id', contractId)
    .eq('application_id', access.application.id)
    .maybeSingle()

  if (!contract) {
    redirect('/error?message=' + encodeURIComponent('Договор не найден в кабинете семьи.'))
  }

  const nextStatus = ['ready', 'sent'].includes(contract.status) ? 'viewed' : contract.status
  const nextNotes = note ? [contract.notes, note].filter(Boolean).join('\n\n') : contract.notes

  await admin
    .from('contracts')
    .update({
      status: nextStatus,
      viewed_at: new Date().toISOString(),
      signatory_name: signatoryName,
      signatory_email: signatoryEmail,
      notes: nextNotes,
    })
    .eq('id', contract.id)

  await admin.from('applications').update({ portal_last_opened_at: new Date().toISOString() }).eq('id', access.application.id)

  await admin.from('activity_log').insert([
    {
      entity_type: 'contract',
      entity_id: contract.id,
      event_type: 'portal_acknowledged',
      title: 'Семья подтвердила ознакомление с договором',
      body: note || signatoryName || signatoryEmail || 'Ознакомление подтверждено из кабинета семьи.',
      metadata: { source: 'portal', application_id: access.application.id, signatory_name: signatoryName, signatory_email: signatoryEmail },
    },
    {
      entity_type: 'application',
      entity_id: access.application.id,
      event_type: 'portal_contract_acknowledged',
      title: 'В кабинете семьи подтверждено ознакомление с договором',
      body: signatoryName || signatoryEmail || 'Семья открыла и подтвердила договор.',
      metadata: { source: 'portal', contract_id: contract.id },
    },
  ])

  redirect(`/portal/${token}/contracts/${contract.id}?status=acknowledged`)
}
