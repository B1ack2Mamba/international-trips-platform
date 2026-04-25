'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility, requireDashboardAccess } from '@/lib/auth'

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
  revalidatePath('/dashboard/deals')
  revalidatePath('/dashboard/tasks')
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

export async function assignSystemDealOwnerAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/system', 'deal.update')
  const dealId = value(formData, 'deal_id')
  const ownerUserId = optionalValue(formData, 'owner_user_id')

  const { error } = await supabase
    .from('deals')
    .update({ owner_user_id: ownerUserId })
    .eq('id', dealId)

  if (error) {
    redirect(`/error?message=${encodeURIComponent(error.message)}`)
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user?.id ?? null,
    entity_type: 'deal',
    entity_id: dealId,
    event_type: 'deal_owner_transferred',
    title: 'Ответственный назначен из системного центра',
    body: ownerUserId ? 'Сделка передана менеджеру.' : 'Ответственный снят.',
    metadata: { owner_user_id: ownerUserId, source: 'system_center' },
  })

  refreshSystemPaths()
}

export async function escalateSystemIssueAction(formData: FormData) {
  const { supabase, user } = await requireDashboardAccess('/dashboard/system')
  const issueId = value(formData, 'issue_id')
  const issueTitle = value(formData, 'issue_title')
  const issueDetail = optionalValue(formData, 'issue_detail')
  const issueHref = optionalValue(formData, 'issue_href')
  const ownerUserId = optionalValue(formData, 'owner_user_id') || user?.id || null
  const dealId = optionalValue(formData, 'deal_id')
  const leadId = optionalValue(formData, 'lead_id')
  const slaBucket = value(formData, 'sla_bucket')
  const priority = slaBucket === 'critical' ? 'critical' : 'high'

  const { data: existingTask } = await supabase
    .from('tasks')
    .select('id')
    .contains('metadata', { system_issue_id: issueId })
    .in('status', ['todo', 'doing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (!existingTask?.id) {
    const dueDate = new Date(Date.now() + (slaBucket === 'critical' ? 60 : 4 * 60) * 60 * 1000).toISOString()
    await supabase.from('tasks').insert({
      owner_user_id: ownerUserId,
      lead_id: leadId,
      deal_id: dealId,
      title: `Эскалация: ${issueTitle}`,
      description: [issueDetail, issueHref ? `Открыть: ${issueHref}` : null].filter(Boolean).join('\n\n') || null,
      status: 'todo',
      priority,
      due_date: dueDate,
      metadata: {
        source: 'system_center',
        system_issue_id: issueId,
        system_issue_href: issueHref,
        automation_key: 'system_issue_escalation',
      },
    })
  }

  if (dealId) {
    await supabase.from('activity_log').insert({
      actor_user_id: user?.id ?? null,
      entity_type: 'deal',
      entity_id: dealId,
      event_type: 'system_issue_escalated',
      title: 'Проблема эскалирована',
      body: issueTitle,
      metadata: { system_issue_id: issueId, source: 'system_center' },
    })
  }

  if (leadId) {
    await supabase.from('activity_log').insert({
      actor_user_id: user?.id ?? null,
      entity_type: 'lead',
      entity_id: leadId,
      event_type: 'system_issue_escalated',
      title: 'Проблема эскалирована',
      body: issueTitle,
      metadata: { system_issue_id: issueId, source: 'system_center' },
    })
  }

  refreshSystemPaths(leadId)
}
