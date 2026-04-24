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

function refreshSystemPaths(leadId?: string | null) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/system')
  revalidatePath('/dashboard/communications')
  revalidatePath('/dashboard/my-leads')
  if (leadId) revalidatePath(`/dashboard/my-leads?open=${leadId}`)
}

export async function requeueOutboxMessageAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/system', 'communication.outbox_manage')
  const messageId = value(formData, 'message_id')

  const { error } = await supabase
    .from('message_outbox')
    .update({
      status: 'queued',
      last_error: null,
      sent_at: null,
      send_after: new Date().toISOString(),
    })
    .eq('id', messageId)

  if (error) {
    redirect(`/error?message=${encodeURIComponent(error.message)}`)
  }

  refreshSystemPaths()
}

export async function markSystemInboxHandledAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/system', 'communication.outbox_manage')
  const messageId = value(formData, 'message_id')
  const leadId = optionalValue(formData, 'lead_id')

  const { error } = await supabase
    .from('message_inbox')
    .update({
      status: 'handled',
      handled_at: new Date().toISOString(),
      handled_by: user?.id ?? null,
    })
    .eq('id', messageId)

  if (error) {
    redirect(`/error?message=${encodeURIComponent(error.message)}`)
  }

  if (leadId) {
    await supabase
      .from('tasks')
      .update({ status: 'done' })
      .eq('lead_id', leadId)
      .in('status', ['todo', 'doing'])
      .contains('metadata', { automation_key: 'lead_inbound_reply' })

    await supabase.from('activity_log').insert({
      actor_user_id: user?.id ?? null,
      entity_type: 'lead',
      entity_id: leadId,
      event_type: 'lead_inbound_message_handled',
      title: 'Входящее сообщение отработано',
      body: 'Сообщение закрыто из системного центра.',
      metadata: { message_inbox_id: messageId, source: 'system_center' },
    })
  }

  refreshSystemPaths(leadId)
}
