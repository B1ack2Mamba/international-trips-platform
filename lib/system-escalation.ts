import { scheduleInboundReplyTask } from '@/lib/lead-automation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDealFlowSummaries } from '@/lib/queries'
import { scheduleDealApplicationTask, scheduleDealContractTask, scheduleDealPaymentTask } from '@/lib/deal-automation'

type AdminClient = ReturnType<typeof createAdminClient>

async function hasOpenSystemTask(supabase: AdminClient, issueId: string) {
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .contains('metadata', { system_issue_id: issueId })
    .in('status', ['todo', 'doing'])
    .limit(1)
    .maybeSingle<{ id: string }>()

  return Boolean(data?.id)
}

async function createSystemTask(params: {
  supabase: AdminClient
  issueId: string
  ownerUserId?: string | null
  leadId?: string | null
  dealId?: string | null
  title: string
  description: string
  priority: 'high' | 'critical'
  dueInHours: number
}) {
  if (await hasOpenSystemTask(params.supabase, params.issueId)) {
    return false
  }

  const dueDate = new Date(Date.now() + params.dueInHours * 60 * 60 * 1000).toISOString()
  const { data } = await params.supabase
    .from('tasks')
    .insert({
      owner_user_id: params.ownerUserId ?? null,
      lead_id: params.leadId ?? null,
      deal_id: params.dealId ?? null,
      title: params.title,
      description: params.description,
      status: 'todo',
      priority: params.priority,
      due_date: dueDate,
      metadata: {
        source: 'system_escalation_cron',
        system_issue_id: params.issueId,
        automation_key: 'system_issue_escalation',
      },
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  return Boolean(data?.id)
}

export async function runSystemEscalationBatch(limit = 50) {
  const supabase = createAdminClient()
  const now = Date.now()
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString()
  const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()

  const [staleInboxRes, staleDealsRes, failedMessagesRes, stuckMessagesRes, failedCallsRes] = await Promise.all([
    supabase
      .from('message_inbox')
      .select('id, lead_id, channel, received_at, lead:leads(id, owner_user_id, contact_name_raw)')
      .neq('status', 'handled')
      .lt('received_at', dayAgo)
      .order('received_at', { ascending: false })
      .limit(limit),
    supabase
      .from('deals')
      .select('id, lead_id, owner_user_id, title, estimated_value, currency, created_at')
      .in('stage', ['qualified', 'proposal', 'negotiation'])
      .lt('created_at', twoDaysAgo)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('message_outbox')
      .select('id, lead_id, deal_id, recipient_name, subject, last_error')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('message_outbox')
      .select('id, lead_id, deal_id, recipient_name, subject, send_after')
      .in('status', ['queued', 'processing'])
      .lt('send_after', twoHoursAgo)
      .order('send_after', { ascending: true })
      .limit(limit),
    supabase
      .from('call_logs')
      .select('id, lead_id, deal_id, owner_user_id, request_description, last_error')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  let created = 0

  for (const inbox of (staleInboxRes.data ?? []) as Array<{
    id: string
    lead_id: string | null
    channel: string | null
    lead?: { id: string; owner_user_id: string | null; contact_name_raw: string | null } | { id: string; owner_user_id: string | null; contact_name_raw: string | null }[] | null
  }>) {
    if (!inbox.lead_id) continue
    const lead = Array.isArray(inbox.lead) ? (inbox.lead[0] ?? null) : inbox.lead
    const taskId = await scheduleInboundReplyTask({
      supabase,
      actorUserId: null,
      leadId: inbox.lead_id,
      ownerUserId: lead?.owner_user_id ?? null,
      channel: inbox.channel || 'manual',
    })
    if (taskId) created += 1
  }

  const staleDeals = (staleDealsRes.data ?? []) as Array<{
    id: string
    lead_id: string | null
    owner_user_id: string | null
    title: string
    estimated_value: number | null
    currency: string | null
  }>
  const flowByDealId = await getDealFlowSummaries(staleDeals.map((deal) => deal.id))

  for (const deal of staleDeals) {
    const flow = flowByDealId[deal.id]
    const amount = flow?.payment_amount || Number(deal.estimated_value ?? 0) || 0
    const paid = flow?.payment_paid_amount || 0

    if (!flow?.contract_id) {
      const taskId = await scheduleDealContractTask({
        supabase,
        actorUserId: null,
        dealId: deal.id,
        leadId: deal.lead_id,
        ownerUserId: deal.owner_user_id,
        dealTitle: deal.title,
      })
      if (taskId) created += 1
      continue
    }

    if (flow.contract_status === 'signed' && amount > 0 && paid < amount) {
      const taskId = await scheduleDealPaymentTask({
        supabase,
        actorUserId: null,
        dealId: deal.id,
        leadId: deal.lead_id,
        ownerUserId: deal.owner_user_id,
        amount: amount - paid,
        currency: deal.currency,
      })
      if (taskId) created += 1
      continue
    }

    if (flow.contract_status === 'signed' && (!amount || paid >= amount) && !flow.application_id) {
      const taskId = await scheduleDealApplicationTask({
        supabase,
        actorUserId: null,
        dealId: deal.id,
        leadId: deal.lead_id,
        ownerUserId: deal.owner_user_id,
      })
      if (taskId) created += 1
    }
  }

  for (const row of (failedMessagesRes.data ?? []) as Array<{
    id: string
    lead_id: string | null
    deal_id: string | null
    recipient_name: string | null
    subject: string | null
    last_error: string | null
  }>) {
    const taskCreated = await createSystemTask({
      supabase,
      issueId: `message_failed_${row.id}`,
      leadId: row.lead_id,
      dealId: row.deal_id,
      title: `Сбой отправки: ${row.recipient_name || row.subject || row.id}`,
      description: row.last_error || 'Исходящее сообщение упало и требует ручной проверки.',
      priority: 'high',
      dueInHours: 4,
    })
    if (taskCreated) created += 1
  }

  for (const row of (stuckMessagesRes.data ?? []) as Array<{
    id: string
    lead_id: string | null
    deal_id: string | null
    recipient_name: string | null
    subject: string | null
    send_after: string | null
  }>) {
    const taskCreated = await createSystemTask({
      supabase,
      issueId: `message_stuck_${row.id}`,
      leadId: row.lead_id,
      dealId: row.deal_id,
      title: `Зависла отправка: ${row.recipient_name || row.subject || row.id}`,
      description: `Очередь не обработана с ${row.send_after || 'неизвестной даты'}.`,
      priority: 'high',
      dueInHours: 4,
    })
    if (taskCreated) created += 1
  }

  for (const row of (failedCallsRes.data ?? []) as Array<{
    id: string
    lead_id: string | null
    deal_id: string | null
    owner_user_id: string | null
    request_description: string | null
    last_error: string | null
  }>) {
    const taskCreated = await createSystemTask({
      supabase,
      issueId: `call_failed_${row.id}`,
      ownerUserId: row.owner_user_id,
      leadId: row.lead_id,
      dealId: row.deal_id,
      title: `Сбой звонка: ${row.request_description || row.id}`,
      description: row.last_error || 'Телефонный сценарий завершился ошибкой.',
      priority: 'critical',
      dueInHours: 1,
    })
    if (taskCreated) created += 1
  }

  return {
    ok: true,
    created,
    scanned: {
      stale_inbox: (staleInboxRes.data ?? []).length,
      stale_deals: staleDeals.length,
      failed_messages: (failedMessagesRes.data ?? []).length,
      stuck_messages: (stuckMessagesRes.data ?? []).length,
      failed_calls: (failedCallsRes.data ?? []).length,
    },
  }
}
