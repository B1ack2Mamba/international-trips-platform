'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility, requireDashboardAccess } from '@/lib/auth'
import { queueTemplateMessage } from '@/lib/messaging'
import { dispatchOutboxBatch } from '@/lib/outbox-dispatch'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function refreshCommunicationPaths() {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/communications')
  revalidatePath('/dashboard/reports')
}

async function buildApplicationPayload(supabase: Awaited<ReturnType<typeof requireDashboardAccess>>['supabase'], applicationId: string) {
  const { data: application, error } = await supabase
    .from('applications')
    .select(`id, participant_name, guardian_name, guardian_email, amount_total, amount_paid,
      deal:deals(id, title, currency, program:programs(title), departure:departures(departure_name, start_date, end_date)),
      departure:departures(departure_name, start_date, end_date),
      contracts:contracts(contract_number, status, created_at),
      payments:payments(label, amount, currency, due_date, status, created_at),
      documents:application_documents(title, rejected_reason, status, reviewed_at)`) 
    .eq('id', applicationId)
    .maybeSingle()

  if (error || !application) {
    throw new Error(error?.message ?? 'application_not_found')
  }

  const deal = application.deal as
    | {
        title?: string | null
        currency?: string | null
        program?: { title?: string | null } | null
        departure?: { departure_name?: string | null; start_date?: string | null; end_date?: string | null } | null
      }
    | null
  const departure =
    (application.departure as { departure_name?: string | null; start_date?: string | null; end_date?: string | null } | null) ??
    deal?.departure ??
    null
  const latestContract = ((application.contracts as Array<Record<string, unknown>> | null) ?? [])[0] ?? null
  const latestPayment = ((application.payments as Array<Record<string, unknown>> | null) ?? [])[0] ?? null
  const latestRejectedDocument = (((application.documents as Array<Record<string, unknown>> | null) ?? []).find(
    (document) => document.status === 'rejected',
  ) ?? null) as Record<string, unknown> | null

  const amountDue = Math.max(Number(application.amount_total ?? 0) - Number(application.amount_paid ?? 0), 0)

  return {
    application,
    payload: {
      participant_name: application.participant_name,
      guardian_name: application.guardian_name ?? 'родитель',
      program_title: deal?.program?.title ?? 'Программа',
      departure_name: departure?.departure_name ?? 'Выезд',
      contract_number: String(latestContract?.contract_number ?? '—'),
      payment_label: String(latestPayment?.label ?? 'Платёж'),
      payment_amount: String(latestPayment?.amount ?? amountDue),
      payment_due_date: String(latestPayment?.due_date ?? '—'),
      currency: String(latestPayment?.currency ?? deal?.currency ?? 'RUB'),
      document_title: String(latestRejectedDocument?.title ?? 'Документ'),
      rejected_reason: String(latestRejectedDocument?.rejected_reason ?? 'Нужно обновить документ'),
    },
  }
}

export async function queueApplicationTemplateAction(formData: FormData) {
  const context = await requireAbility('/dashboard/communications', 'communication.queue')
  const applicationId = value(formData, 'application_id')
  const templateCode = value(formData, 'template_code')
  const sendAfter = value(formData, 'send_after') || null

  try {
    const { application, payload } = await buildApplicationPayload(context.supabase, applicationId)
    await queueTemplateMessage({
      templateCode,
      applicationId,
      recipientName: application.guardian_name ?? null,
      recipientEmail: application.guardian_email ?? null,
      payload,
      sendAfter,
      metadata: {
        source: 'dashboard_communications_queue_application',
      },
    })
  } catch (error) {
    redirect(`/error?message=${encodeURIComponent(String(error))}`)
  }

  refreshCommunicationPaths()
}

export async function queueManualMessageAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/communications', 'communication.queue')
  const channel = value(formData, 'channel') || 'email'
  const audience = value(formData, 'audience') || 'family'
  const body = value(formData, 'body')
  const sendAfter = value(formData, 'send_after')

  if (!body) return

  const { error } = await supabase.from('message_outbox').insert({
    channel: ['email', 'telegram', 'whatsapp', 'sms', 'internal'].includes(channel) ? channel : 'email',
    audience: ['family', 'staff', 'partner', 'system'].includes(audience) ? audience : 'family',
    template_code: null,
    recipient_name: value(formData, 'recipient_name') || null,
    recipient_email: value(formData, 'recipient_email') || null,
    recipient_phone: value(formData, 'recipient_phone') || null,
    subject: value(formData, 'subject') || null,
    body,
    send_after: sendAfter ? new Date(sendAfter).toISOString() : new Date().toISOString(),
    metadata: { source: 'dashboard_manual_message' },
  })

  if (error) redirect(`/error?message=${encodeURIComponent(error.message)}`)
  refreshCommunicationPaths()
}

export async function updateOutboxStatusAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/communications', 'communication.outbox_manage')
  const messageId = value(formData, 'message_id')
  const status = value(formData, 'status')

  const { error } = await supabase
    .from('message_outbox')
    .update({
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      last_error: status === 'failed' ? value(formData, 'last_error') || 'manual_fail' : null,
    })
    .eq('id', messageId)

  if (error) redirect(`/error?message=${encodeURIComponent(error.message)}`)
  refreshCommunicationPaths()
}

export async function dispatchOutboxNowAction(formData: FormData) {
  await requireAbility('/dashboard/communications', 'communication.dispatch')

  const rawLimit = Number(value(formData, 'limit') || '20')
  const limit = Number.isFinite(rawLimit) ? rawLimit : 20

  try {
    await dispatchOutboxBatch({
      limit,
      requestSource: 'dashboard_manual',
    })
  } catch (error) {
    redirect(`/error?message=${encodeURIComponent(String(error))}`)
  }

  refreshCommunicationPaths()
}
