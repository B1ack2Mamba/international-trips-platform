'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility } from '@/lib/auth'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function optionalValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  return raw || null
}

function numberValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function refreshApplicationPaths(applicationId?: string, contractId?: string, departureId?: string | null, dealId?: string | null) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/applications')
  revalidatePath('/dashboard/contracts')
  revalidatePath('/dashboard/finance')
  revalidatePath('/dashboard/ops')
  revalidatePath('/dashboard/departures')
  if (applicationId) revalidatePath(`/dashboard/applications/${applicationId}`)
  if (contractId) revalidatePath(`/dashboard/contracts/${contractId}`)
  if (departureId) {
    revalidatePath(`/dashboard/ops/${departureId}`)
    revalidatePath(`/dashboard/departures/${departureId}`)
    revalidatePath(`/dashboard/applications?departure_id=${departureId}`)
  }
  if (dealId) revalidatePath(`/dashboard/deals/${dealId}`)
}

async function findRecentDuplicatePayment(params: {
  supabase: Awaited<ReturnType<typeof requireAbility>>['supabase']
  applicationId: string
  label: string
  amount: number
  currency: string
}) {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data } = await params.supabase
    .from('payments')
    .select('id, deal_id')
    .eq('application_id', params.applicationId)
    .eq('label', params.label)
    .eq('amount', params.amount)
    .eq('currency', params.currency)
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; deal_id: string | null }>()

  return data ?? null
}

export async function updateApplicationStatusAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/applications', 'application.update')
  const applicationId = value(formData, 'application_id')
  await supabase.rpc('update_application_status', {
    p_application_id: applicationId,
    p_status: value(formData, 'status'),
    p_visa_status: optionalValue(formData, 'visa_status'),
    p_note: optionalValue(formData, 'note'),
  })
  refreshApplicationPaths(applicationId)
}

export async function updateApplicationContextAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/applications', 'application.update')
  const applicationId = value(formData, 'application_id')
  const departureId = optionalValue(formData, 'departure_id')
  const dealId = optionalValue(formData, 'deal_id')

  const { error } = await supabase
    .from('applications')
    .update({
      participant_name: value(formData, 'participant_name'),
      guardian_name: optionalValue(formData, 'guardian_name'),
      guardian_phone: optionalValue(formData, 'guardian_phone'),
      guardian_email: optionalValue(formData, 'guardian_email'),
      departure_id: departureId,
      amount_total: numberValue(formData, 'amount_total'),
      notes: optionalValue(formData, 'notes'),
    })
    .eq('id', applicationId)

  if (error) {
    redirect('/error?message=' + encodeURIComponent(error.message))
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user?.id ?? null,
    entity_type: 'application',
    entity_id: applicationId,
    event_type: 'application_context_updated',
    title: 'Контекст заявки обновлён',
    body: 'Обновлены данные участника, родителя или выезда.',
    metadata: {
      departure_id: departureId,
      deal_id: dealId,
    },
  })

  refreshApplicationPaths(applicationId, undefined, departureId, dealId)
}

export async function seedApplicationChecklistAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/applications', 'application.checklist_seed')
  const applicationId = value(formData, 'application_id')
  await supabase.rpc('seed_application_document_checklist', { p_application_id: applicationId })
  refreshApplicationPaths(applicationId)
}

export async function updateApplicationDocumentStatusAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/applications', 'application.document_update')
  const applicationId = value(formData, 'application_id')
  await supabase.rpc('update_application_document_status', {
    p_document_id: value(formData, 'document_id'),
    p_status: value(formData, 'status'),
    p_note: optionalValue(formData, 'note'),
    p_rejected_reason: optionalValue(formData, 'rejected_reason'),
    p_file_path: optionalValue(formData, 'file_path'),
  })
  refreshApplicationPaths(applicationId)
}

export async function createPaymentForApplicationAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/applications', 'finance.payment_create')
  const applicationId = value(formData, 'application_id')

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .select(`id, deal_id, guardian_name, guardian_email,
      deal:deals(currency, title)`) 
    .eq('id', applicationId)
    .maybeSingle()

  if (applicationError || !application) {
    redirect('/error?message=' + encodeURIComponent(applicationError?.message ?? 'Заявка для платежа не найдена'))
  }

  const deal = Array.isArray(application.deal) ? application.deal[0] ?? null : application.deal
  const currency = value(formData, 'currency') || (deal && typeof deal === 'object' && 'currency' in deal && typeof deal.currency === 'string' ? deal.currency : 'RUB')
  const amount = numberValue(formData, 'amount')

  if (amount === null || amount < 0) {
    redirect('/error?message=' + encodeURIComponent('Укажи корректную сумму платежа'))
  }

  const paymentLabel = value(formData, 'label') || 'Платёж'
  const duplicatePayment = await findRecentDuplicatePayment({
    supabase,
    applicationId,
    label: paymentLabel,
    amount,
    currency,
  })

  if (duplicatePayment?.id) {
    refreshApplicationPaths(applicationId, undefined, null, application.deal_id as string | null)
    redirect(`/dashboard/applications/${applicationId}?existing_payment=${encodeURIComponent(duplicatePayment.id)}`)
  }

  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      deal_id: application.deal_id as string | null,
      application_id: applicationId,
      payer_name: optionalValue(formData, 'payer_name') || (application.guardian_name as string | null) || (application.guardian_email as string | null) || 'Плательщик',
      label: paymentLabel,
      amount,
      currency,
      due_date: optionalValue(formData, 'due_date'),
      status: value(formData, 'status') || 'pending',
      metadata: {
        created_via: 'application_card',
        created_by_user_id: user?.id ?? null,
      },
    })
    .select('id')
    .maybeSingle()

  if (error || !payment) {
    redirect('/error?message=' + encodeURIComponent(error?.message ?? 'Не удалось создать платёж'))
  }

  await supabase.from('activity_log').insert([
    {
      actor_user_id: user?.id ?? null,
      entity_type: 'payment',
      entity_id: payment.id,
      event_type: 'payment_created',
      title: 'Создан платёж',
      body: value(formData, 'label') || 'Платёж',
      metadata: {
        application_id: applicationId,
        deal_id: application.deal_id as string | null,
        amount,
        currency,
      },
    },
    {
      actor_user_id: user?.id ?? null,
      entity_type: 'application',
      entity_id: applicationId,
      event_type: 'payment_created',
      title: 'Создан связанный платёж',
      body: value(formData, 'label') || 'Платёж',
      metadata: {
        payment_id: payment.id,
        amount,
        currency,
      },
    },
  ])

  refreshApplicationPaths(applicationId, undefined, null, application.deal_id as string | null)
}

export async function createContractFromApplicationAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/applications', 'application.contract_create')
  const applicationId = value(formData, 'application_id')
  const { data: existingContract } = await supabase
    .from('contracts')
    .select('id')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (existingContract?.id) {
    refreshApplicationPaths(applicationId, existingContract.id)
    redirect(`/dashboard/contracts/${existingContract.id}`)
  }

  const { data, error } = await supabase.rpc('create_contract_from_application', {
    p_application_id: applicationId,
    p_template_code: value(formData, 'template_code') || 'family_standard',
    p_mark_ready: value(formData, 'mark_ready') === 'on',
  })
  if (error || !data) {
    redirect(`/error?message=${encodeURIComponent(error?.message ?? 'Не удалось создать договор')}`)
  }
  refreshApplicationPaths(applicationId, data)
  redirect(`/dashboard/contracts/${data}`)
}

export async function rotatePortalAccessAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/applications', 'application.portal_manage')
  const applicationId = value(formData, 'application_id')
  const expiresAt = optionalValue(formData, 'portal_access_expires_at')
  await supabase.rpc('rotate_application_portal_token', {
    p_application_id: applicationId,
    p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
  })
  refreshApplicationPaths(applicationId)
}

export async function updatePortalAuthModeAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/applications', 'application.portal_manage')
  const applicationId = value(formData, 'application_id')
  const portalAuthMode = value(formData, 'portal_auth_mode') || 'link'
  await supabase.from('applications').update({ portal_auth_mode: portalAuthMode }).eq('id', applicationId)
  refreshApplicationPaths(applicationId)
}
