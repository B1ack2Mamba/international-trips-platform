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

function refreshFinancePaths(applicationId?: string | null, dealId?: string | null) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/finance')
  revalidatePath('/dashboard/applications')
  revalidatePath('/dashboard/deals')
  if (applicationId) revalidatePath(`/dashboard/finance?application_id=${applicationId}`)
  if (dealId) revalidatePath(`/dashboard/finance?deal_id=${dealId}`)
  if (applicationId) revalidatePath(`/dashboard/applications/${applicationId}`)
  if (dealId) revalidatePath(`/dashboard/deals/${dealId}`)
}

export async function createPaymentAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/finance', 'finance.payment_create')
  const applicationId = optionalValue(formData, 'application_id')
  let dealId = optionalValue(formData, 'deal_id')
  let payerName = optionalValue(formData, 'payer_name')
  let currency = value(formData, 'currency') || 'RUB'

  if (!applicationId && !dealId) {
    redirect('/error?message=' + encodeURIComponent('Для платежа нужна заявка или сделка'))
  }

  if (applicationId) {
    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select(`id, deal_id, guardian_name, guardian_email,
        deal:deals(currency, title)`)
      .eq('id', applicationId)
      .maybeSingle()

    if (applicationError || !application) {
      redirect('/error?message=' + encodeURIComponent(applicationError?.message ?? 'Заявка для платежа не найдена'))
    }

    dealId = dealId || (application.deal_id as string | null)
    payerName = payerName || (application.guardian_name as string | null) || (application.guardian_email as string | null) || 'Плательщик'

    const deal = Array.isArray(application.deal) ? application.deal[0] ?? null : application.deal
    if (!value(formData, 'currency') && deal && typeof deal === 'object' && 'currency' in deal && typeof deal.currency === 'string') {
      currency = deal.currency
    }
  }

  const amount = numberValue(formData, 'amount')
  if (amount === null || amount < 0) {
    redirect('/error?message=' + encodeURIComponent('Укажи корректную сумму платежа'))
  }

  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      deal_id: dealId,
      application_id: applicationId,
      payer_name: payerName || 'Плательщик',
      label: value(formData, 'label') || 'Платёж',
      amount,
      currency,
      due_date: optionalValue(formData, 'due_date'),
      status: value(formData, 'status') || 'pending',
      metadata: {
        created_via: 'crm_finance',
        created_by_user_id: user?.id ?? null,
      },
    })
    .select('id')
    .maybeSingle()

  if (error || !payment) {
    redirect('/error?message=' + encodeURIComponent(error?.message ?? 'Не удалось создать платёж'))
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user?.id ?? null,
    entity_type: 'payment',
    entity_id: payment.id,
    event_type: 'payment_created',
    title: 'Создан платёж',
    body: value(formData, 'label') || 'Платёж',
    metadata: {
      application_id: applicationId,
      deal_id: dealId,
      amount,
      currency,
    },
  })

  if (applicationId) {
    await supabase.from('activity_log').insert({
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
    })
  }

  refreshFinancePaths(applicationId, dealId)
}

export async function markPaymentPaidAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/finance', 'finance.payment_mark_paid')
  await supabase.rpc('mark_payment_paid', {
    p_payment_id: value(formData, 'payment_id'),
    p_note: value(formData, 'note') || null,
  })

  refreshFinancePaths(optionalValue(formData, 'application_id'), optionalValue(formData, 'deal_id'))
}

export async function updatePaymentProgressAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/finance', 'finance.payment_mark_paid')
  const paymentId = value(formData, 'payment_id')
  const applicationId = optionalValue(formData, 'application_id')
  const dealId = optionalValue(formData, 'deal_id')
  const paidAmount = Math.max(0, numberValue(formData, 'paid_amount') ?? 0)

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('id, amount, metadata')
    .eq('id', paymentId)
    .maybeSingle()

  if (paymentError || !payment) {
    redirect('/error?message=' + encodeURIComponent(paymentError?.message ?? 'Платёж не найден'))
  }

  const totalAmount = Number(payment.amount ?? 0)
  const nextStatus = paidAmount >= totalAmount && totalAmount > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'due'
  const baseMetadata = payment.metadata && typeof payment.metadata === 'object' ? payment.metadata as Record<string, unknown> : {}
  const nextMetadata = {
    ...baseMetadata,
    paid_amount: paidAmount,
    remaining_amount: Math.max(0, totalAmount - paidAmount),
    updated_via: 'finance_progress',
    updated_by_user_id: user?.id ?? null,
  }

  const { error } = await supabase
    .from('payments')
    .update({
      status: nextStatus,
      paid_at: paidAmount > 0 ? new Date().toISOString() : null,
      metadata: nextMetadata,
    })
    .eq('id', paymentId)

  if (error) {
    redirect('/error?message=' + encodeURIComponent(error.message))
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user?.id ?? null,
    entity_type: 'payment',
    entity_id: paymentId,
    event_type: 'payment_progress_updated',
    title: 'Обновлён прогресс оплаты',
    body: `Оплачено ${paidAmount} из ${totalAmount}` ,
    metadata: {
      application_id: applicationId,
      deal_id: dealId,
      paid_amount: paidAmount,
      total_amount: totalAmount,
      status: nextStatus,
    },
  })

  refreshFinancePaths(applicationId, dealId)
}
