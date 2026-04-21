'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility } from '@/lib/auth'
import { hasServiceRole } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function optionalValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  return raw || null
}

function numberValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  return raw ? Number(raw) : null
}

function refreshDealPaths(dealId?: string, applicationId?: string, departureId?: string | null) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/deals')
  revalidatePath('/dashboard/applications')
  revalidatePath('/dashboard/contracts')
  revalidatePath('/dashboard/finance')
  revalidatePath('/dashboard/ops')
  revalidatePath('/dashboard/departures')
  if (dealId) revalidatePath(`/dashboard/deals/${dealId}`)
  if (applicationId) revalidatePath(`/dashboard/applications/${applicationId}`)
  if (departureId) {
    revalidatePath(`/dashboard/ops/${departureId}`)
    revalidatePath(`/dashboard/departures/${departureId}`)
    revalidatePath(`/dashboard/applications?departure_id=${departureId}`)
  }
}

async function ensurePaymentAndContractRequest(
  supabase: Awaited<ReturnType<typeof requireAbility>>['supabase'],
  payload: {
    dealId: string
    leadId: string | null
    ownerUserId: string | null
    payerName: string
    amount: number | null
    currency: string
    dueDate: string | null
    title: string
  },
) {
  const amount = Number(payload.amount ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) return

  const writer = hasServiceRole() ? createAdminClient() : supabase

  const existingPayment = await writer
    .from('payments')
    .select('id, metadata')
    .eq('deal_id', payload.dealId)
    .is('application_id', null)
    .ilike('label', 'Оплата по сделке%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingPayment.data?.id) {
    const currentMeta = existingPayment.data.metadata && typeof existingPayment.data.metadata === 'object'
      ? existingPayment.data.metadata as Record<string, unknown>
      : {}
    await writer
      .from('payments')
      .update({
        payer_name: payload.payerName || 'Плательщик',
        amount,
        currency: payload.currency || 'RUB',
        due_date: payload.dueDate,
        status: Number(currentMeta['paid_amount'] ?? 0) > 0 ? (Number(currentMeta['paid_amount']) >= amount ? 'paid' : 'partial') : 'due',
        metadata: {
          ...currentMeta,
          autocreated_from_deal: true,
          deal_title: payload.title,
          remaining_amount: Math.max(0, amount - Number(currentMeta['paid_amount'] ?? 0)),
        },
      })
      .eq('id', existingPayment.data.id)
  } else {
    await writer.from('payments').insert({
      deal_id: payload.dealId,
      application_id: null,
      payer_name: payload.payerName || 'Плательщик',
      label: 'Оплата по сделке',
      amount,
      currency: payload.currency || 'RUB',
      due_date: payload.dueDate,
      status: 'due',
      metadata: {
        autocreated_from_deal: true,
        paid_amount: 0,
        remaining_amount: amount,
        deal_title: payload.title,
      },
    })
  }

  const existingTask = await writer
    .from('tasks')
    .select('id')
    .eq('deal_id', payload.dealId)
    .eq('title', 'Составить договор')
    .in('status', ['todo', 'doing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!existingTask.data?.id) {
    await writer.from('tasks').insert({
      owner_user_id: payload.ownerUserId,
      lead_id: payload.leadId,
      deal_id: payload.dealId,
      title: 'Составить договор',
      description: `Подготовить договор по сделке «${payload.title}».`,
      status: 'todo',
      priority: 'high',
      metadata: {
        autocreated_from_deal: true,
        request_kind: 'contract_draft',
      },
    })
  }
}

async function createApplicationFromDealBestEffort(
  supabase: Awaited<ReturnType<typeof requireAbility>>['supabase'],
  payload: {
    p_deal_id: string
    p_participant_name: string
    p_guardian_name: string | null
    p_guardian_phone: string | null
    p_guardian_email: string | null
    p_amount_total: number | null
    p_due_date: string | null
    p_payment_label: string
    p_payment_amount: number | null
    p_create_payment: boolean
  },
) {
  const primary = await supabase.rpc('create_application_from_deal', payload)
  if (!primary.error && primary.data) {
    return { applicationId: String(primary.data), error: null as string | null, mode: 'user-rpc' }
  }

  if (hasServiceRole()) {
    const admin = createAdminClient()
    const fallback = await admin.rpc('create_application_from_deal', payload)
    if (!fallback.error && fallback.data) {
      return { applicationId: String(fallback.data), error: null as string | null, mode: 'admin-rpc' }
    }
    return {
      applicationId: null,
      error: fallback.error?.message ?? primary.error?.message ?? 'Не удалось создать заявку из сделки',
      mode: 'failed',
    }
  }

  return {
    applicationId: null,
    error: primary.error?.message ?? 'Не удалось создать заявку из сделки',
    mode: 'failed',
  }
}

export async function createDeal(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/deals', 'deal.create')
  const title = value(formData, 'title')

  if (!title) {
    redirect(`/dashboard/deals?error=${encodeURIComponent('Укажи название сделки')}`)
  }

  const payload = {
    owner_user_id: user!.id,
    lead_id: optionalValue(formData, 'lead_id'),
    title,
    stage: value(formData, 'stage') || 'qualified',
    estimated_value: numberValue(formData, 'estimated_value') ?? 0,
    currency: value(formData, 'currency') || 'RUB',
    participants_count: Math.max(1, Number(value(formData, 'participants_count') || 1)),
    close_date: optionalValue(formData, 'close_date'),
    notes: optionalValue(formData, 'notes'),
  }

  let insertedId: string | null = null
  let insertError: string | null = null

  const primary = await supabase.from('deals').insert(payload).select('id').single()
  insertedId = primary.data?.id ?? null
  insertError = primary.error?.message ?? null

  if (!insertedId && hasServiceRole()) {
    const admin = createAdminClient()
    const fallback = await admin.from('deals').insert(payload).select('id').single()
    insertedId = fallback.data?.id ?? null
    insertError = fallback.error?.message ?? insertError
  }

  if (!insertedId) {
    redirect(`/dashboard/deals?error=${encodeURIComponent(insertError ?? 'Сделка не создалась')}`)
  }

  await ensurePaymentAndContractRequest(supabase, {
    dealId: insertedId,
    leadId: payload.lead_id,
    ownerUserId: user!.id,
    payerName: title,
    amount: payload.estimated_value,
    currency: payload.currency,
    dueDate: payload.close_date,
    title: payload.title,
  })

  refreshDealPaths(insertedId)
  redirect(`/dashboard/deals?created=${encodeURIComponent(insertedId)}`)
}

export async function updateDealStage(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/deals', 'deal.update')
  const dealId = value(formData, 'deal_id')
  await supabase.rpc('update_deal_stage', {
    p_deal_id: dealId,
    p_stage: value(formData, 'stage'),
    p_note: optionalValue(formData, 'note'),
  })
  refreshDealPaths(dealId)
}

export async function updateDealContextAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/deals', 'deal.update')
  const dealId = value(formData, 'deal_id')
  const departureId = optionalValue(formData, 'departure_id')

  const { error } = await supabase
    .from('deals')
    .update({
      title: value(formData, 'title'),
      account_id: optionalValue(formData, 'account_id'),
      program_id: optionalValue(formData, 'program_id'),
      departure_id: departureId,
      partner_account_id: optionalValue(formData, 'partner_account_id'),
      estimated_value: numberValue(formData, 'estimated_value'),
      currency: value(formData, 'currency') || 'RUB',
      participants_count: Number(value(formData, 'participants_count') || 1),
      close_date: optionalValue(formData, 'close_date'),
      notes: optionalValue(formData, 'notes'),
    })
    .eq('id', dealId)

  if (error) {
    redirect(`/error?message=${encodeURIComponent(error.message)}`)
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user!.id,
    entity_type: 'deal',
    entity_id: dealId,
    event_type: 'deal_context_updated',
    title: 'Контекст сделки обновлён',
    body: 'Обновлены связи сделки и коммерческие параметры.',
    metadata: {
      account_id: optionalValue(formData, 'account_id'),
      program_id: optionalValue(formData, 'program_id'),
      departure_id: departureId,
      partner_account_id: optionalValue(formData, 'partner_account_id'),
    },
  })

  await ensurePaymentAndContractRequest(supabase, {
    dealId,
    leadId: optionalValue(formData, 'lead_id'),
    ownerUserId: user!.id,
    payerName: value(formData, 'title') || 'Плательщик',
    amount: numberValue(formData, 'estimated_value'),
    currency: value(formData, 'currency') || 'RUB',
    dueDate: optionalValue(formData, 'close_date'),
    title: value(formData, 'title') || 'Сделка',
  })

  refreshDealPaths(dealId, undefined, departureId)
}

export async function createApplicationFromDealAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/deals', 'deal.application_create')
  const dealId = value(formData, 'deal_id')

  const existing = await supabase
    .from('applications')
    .select('id, departure_id')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing.data?.id) {
    await supabase.from('deals').update({ stage: 'won' }).eq('id', dealId)
    refreshDealPaths(dealId, existing.data.id, existing.data.departure_id)
    redirect(`/dashboard/applications?deal_id=${encodeURIComponent(dealId)}&existing=${encodeURIComponent(existing.data.id)}&from=deal`)
  }

  const result = await createApplicationFromDealBestEffort(supabase, {
    p_deal_id: dealId,
    p_participant_name: value(formData, 'participant_name'),
    p_guardian_name: optionalValue(formData, 'guardian_name'),
    p_guardian_phone: optionalValue(formData, 'guardian_phone'),
    p_guardian_email: optionalValue(formData, 'guardian_email'),
    p_amount_total: numberValue(formData, 'amount_total'),
    p_due_date: optionalValue(formData, 'due_date'),
    p_payment_label: value(formData, 'payment_label') || 'Предоплата',
    p_payment_amount: numberValue(formData, 'payment_amount'),
    p_create_payment: value(formData, 'create_payment') === 'on',
  })

  if (!result.applicationId) {
    redirect(`/dashboard/applications?deal_id=${encodeURIComponent(dealId)}&error=${encodeURIComponent(result.error ?? 'Не удалось создать заявку из сделки')}&from=deal`)
  }

  const reader = hasServiceRole() ? createAdminClient() : supabase
  const { data: application } = await reader.from('applications').select('id, departure_id').eq('id', result.applicationId).maybeSingle()
  await supabase.from('deals').update({ stage: 'won' }).eq('id', dealId)
  refreshDealPaths(dealId, application?.id, application?.departure_id)
  redirect(`/dashboard/applications?deal_id=${encodeURIComponent(dealId)}&created=${encodeURIComponent(result.applicationId)}&from=deal&mode=${encodeURIComponent(result.mode)}`)
}

export async function quickCreateApplicationFromDealAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/deals', 'deal.application_create')
  const dealId = value(formData, 'deal_id')

  const existing = await supabase
    .from('applications')
    .select('id, departure_id')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing.data?.id) {
    await supabase.from('deals').update({ stage: 'won' }).eq('id', dealId)
    refreshDealPaths(dealId, existing.data.id, existing.data.departure_id)
    redirect(`/dashboard/applications?deal_id=${encodeURIComponent(dealId)}&existing=${encodeURIComponent(existing.data.id)}&from=deal`)
  }

  const reader = hasServiceRole() ? createAdminClient() : supabase
  const { data: deal, error: dealError } = await reader
    .from('deals')
    .select(`
      id,
      title,
      estimated_value,
      lead:leads!deals_lead_id_fkey(contact_name_raw, phone_raw, email_raw)
    `)
    .eq('id', dealId)
    .maybeSingle()

  if (dealError || !deal) {
    redirect(`/dashboard/deals?error=${encodeURIComponent(dealError?.message ?? 'Не удалось найти сделку для передачи в заявки')}`)
  }

  const lead = Array.isArray(deal.lead) ? (deal.lead[0] ?? null) : deal.lead

  const inferredParticipantName =
    lead?.contact_name_raw?.trim() ||
    deal.title?.trim() ||
    'Участник из сделки'

  const result = await createApplicationFromDealBestEffort(supabase, {
    p_deal_id: dealId,
    p_participant_name: inferredParticipantName,
    p_guardian_name: lead?.contact_name_raw?.trim() || null,
    p_guardian_phone: lead?.phone_raw?.trim() || null,
    p_guardian_email: lead?.email_raw?.trim() || null,
    p_amount_total: Number(deal.estimated_value ?? 0) || null,
    p_due_date: null,
    p_payment_label: 'Предоплата',
    p_payment_amount: null,
    p_create_payment: false,
  })

  if (!result.applicationId) {
    redirect(`/dashboard/applications?deal_id=${encodeURIComponent(dealId)}&error=${encodeURIComponent(result.error ?? 'Не удалось передать сделку в заявки')}&from=deal`)
  }

  const { data: application } = await reader.from('applications').select('id, departure_id').eq('id', result.applicationId).maybeSingle()
  await supabase.from('deals').update({ stage: 'won' }).eq('id', dealId)
  refreshDealPaths(dealId, application?.id, application?.departure_id)
  redirect(`/dashboard/applications?deal_id=${encodeURIComponent(dealId)}&created=${encodeURIComponent(result.applicationId)}&from=deal&mode=${encodeURIComponent(result.mode)}`)
}

export async function completeDealPaymentAndMoveAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/deals', 'deal.application_create')
  const dealId = value(formData, 'deal_id')
  const reader = hasServiceRole() ? createAdminClient() : supabase

  const { data: deal, error: dealError } = await reader
    .from('deals')
    .select(`
      id,
      title,
      estimated_value,
      currency,
      close_date,
      lead:leads!deals_lead_id_fkey(contact_name_raw, phone_raw, email_raw)
    `)
    .eq('id', dealId)
    .maybeSingle()

  if (dealError || !deal) {
    redirect(`/dashboard/deals?error=${encodeURIComponent(dealError?.message ?? 'Сделка не найдена')}`)
  }

  const amount = Number(deal.estimated_value ?? 0)
  const { data: payments } = await reader
    .from('payments')
    .select('id, amount, metadata')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(1)

  const payment = payments?.[0]
  if (payment?.id) {
    const total = Number(payment.amount ?? amount)
    const metadata = payment.metadata && typeof payment.metadata === 'object' ? payment.metadata as Record<string, unknown> : {}
    await supabase
      .from('payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          paid_amount: total,
          remaining_amount: 0,
          completed_from_deal: true,
        },
      })
      .eq('id', payment.id)
  } else if (amount > 0) {
    await supabase.from('payments').insert({
      deal_id: dealId,
      application_id: null,
      payer_name: deal.title || 'Плательщик',
      label: 'Оплата по сделке',
      amount,
      currency: deal.currency || 'RUB',
      due_date: deal.close_date || null,
      status: 'paid',
      paid_at: new Date().toISOString(),
      metadata: {
        paid_amount: amount,
        remaining_amount: 0,
        completed_from_deal: true,
      },
    })
  }

  const lead = Array.isArray(deal.lead) ? (deal.lead[0] ?? null) : deal.lead
  const result = await createApplicationFromDealBestEffort(supabase, {
    p_deal_id: dealId,
    p_participant_name: lead?.contact_name_raw?.trim() || deal.title?.trim() || 'Участник из сделки',
    p_guardian_name: lead?.contact_name_raw?.trim() || null,
    p_guardian_phone: lead?.phone_raw?.trim() || null,
    p_guardian_email: lead?.email_raw?.trim() || null,
    p_amount_total: amount || null,
    p_due_date: null,
    p_payment_label: 'Полная оплата',
    p_payment_amount: amount || null,
    p_create_payment: false,
  })

  if (!result.applicationId) {
    redirect(`/dashboard/deals?open=${encodeURIComponent(dealId)}&error=${encodeURIComponent(result.error ?? 'Оплата отмечена, но участник не создан')}`)
  }

  const { data: application } = await reader.from('applications').select('id, departure_id').eq('id', result.applicationId).maybeSingle()
  await supabase.from('deals').update({ stage: 'won' }).eq('id', dealId)
  refreshDealPaths(dealId, application?.id, application?.departure_id)
  redirect(`/dashboard/applications?deal_id=${encodeURIComponent(dealId)}&created=${encodeURIComponent(result.applicationId)}&from=deal&paid=1`)
}

export async function updateDealPaymentProgressAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/deals', 'deal.update')
  const dealId = value(formData, 'deal_id')
  const paymentId = value(formData, 'payment_id')
  const paidAmount = Math.max(0, numberValue(formData, 'paid_amount') ?? 0)

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, amount, metadata')
    .eq('id', paymentId)
    .eq('deal_id', dealId)
    .maybeSingle()

  if (paymentError || !payment) {
    redirect(`/dashboard/deals?open=${encodeURIComponent(dealId)}&error=${encodeURIComponent(paymentError?.message ?? 'Платёж по сделке не найден')}`)
  }

  const totalAmount = Number(payment.amount ?? 0)
  const nextStatus = paidAmount >= totalAmount && totalAmount > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'due'
  const baseMetadata = payment.metadata && typeof payment.metadata === 'object' ? payment.metadata as Record<string, unknown> : {}
  await supabase
    .from('payments')
    .update({
      status: nextStatus,
      paid_at: paidAmount > 0 ? new Date().toISOString() : null,
      metadata: {
        ...baseMetadata,
        paid_amount: paidAmount,
        remaining_amount: Math.max(0, totalAmount - paidAmount),
        updated_from_deal: true,
        updated_by_user_id: user?.id ?? null,
      },
    })
    .eq('id', paymentId)

  await supabase.from('activity_log').insert({
    actor_user_id: user?.id ?? null,
    entity_type: 'deal',
    entity_id: dealId,
    event_type: 'deal_payment_progress_updated',
    title: 'Обновлена оплата по сделке',
    body: `Клиент внёс ${paidAmount} из ${totalAmount}.`,
    metadata: {
      payment_id: paymentId,
      paid_amount: paidAmount,
      total_amount: totalAmount,
      status: nextStatus,
    },
  })

  refreshDealPaths(dealId)
  redirect(`/dashboard/deals?open=${encodeURIComponent(dealId)}&finance=1#deal-finance-popover`)
}

export async function transferDealOwnerAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/deals', 'deal.update')
  const dealId = value(formData, 'deal_id')
  const ownerUserId = value(formData, 'owner_user_id')

  const { error } = await supabase
    .from('deals')
    .update({ owner_user_id: ownerUserId || null })
    .eq('id', dealId)

  if (error) {
    redirect(`/dashboard/deals?error=${encodeURIComponent(error.message)}`)
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user!.id,
    entity_type: 'deal',
    entity_id: dealId,
    event_type: 'deal_owner_transferred',
    title: 'Сделка передана другому менеджеру',
    body: 'Обновлён ответственный менеджер сделки.',
    metadata: { owner_user_id: ownerUserId || null },
  })

  refreshDealPaths(dealId)
  redirect(`/dashboard/deals?open=${encodeURIComponent(dealId)}`)
}
