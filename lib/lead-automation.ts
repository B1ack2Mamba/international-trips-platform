type QueryClient = {
  from: (table: string) => any
}

function addHours(hours: number) {
  const date = new Date()
  date.setHours(date.getHours() + hours)
  return date.toISOString()
}

async function getLeadContext(supabase: QueryClient, leadId: string) {
  const { data } = await supabase
    .from('leads')
    .select('id, owner_user_id, contact_name_raw, email_raw, phone_raw')
    .eq('id', leadId)
    .maybeSingle()

  return (data ?? null) as {
    id: string
    owner_user_id: string | null
    contact_name_raw: string | null
    email_raw: string | null
    phone_raw: string | null
  } | null
}

async function hasOpenAutomationTask(supabase: QueryClient, leadId: string, automationKey: string) {
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('lead_id', leadId)
    .in('status', ['todo', 'doing'])
    .contains('metadata', { automation_key: automationKey })
    .limit(1)
    .maybeSingle()

  return Boolean((data as { id?: string } | null)?.id)
}

export async function createLeadAutomationTask(params: {
  supabase: QueryClient
  actorUserId?: string | null
  leadId: string
  automationKey: string
  title: string
  description?: string | null
  priority?: 'low' | 'medium' | 'high' | 'critical'
  dueInHours?: number
  ownerUserId?: string | null
  source: string
}) {
  const lead = params.ownerUserId === undefined ? await getLeadContext(params.supabase, params.leadId) : null
  const ownerUserId = params.ownerUserId === undefined ? lead?.owner_user_id : params.ownerUserId

  if (await hasOpenAutomationTask(params.supabase, params.leadId, params.automationKey)) {
    return null
  }

  const dueDate = addHours(params.dueInHours ?? 24)
  const { data, error } = await params.supabase
    .from('tasks')
    .insert({
      owner_user_id: ownerUserId ?? null,
      lead_id: params.leadId,
      title: params.title,
      description: params.description ?? null,
      status: 'todo',
      priority: params.priority ?? 'medium',
      due_date: dueDate,
      metadata: {
        automation_key: params.automationKey,
        source: params.source,
      },
    })
    .select('id')
    .maybeSingle()

  const task = data as { id?: string } | null
  if (error || !task?.id) {
    return null
  }

  await params.supabase.from('activity_log').insert({
    actor_user_id: params.actorUserId ?? null,
    entity_type: 'lead',
    entity_id: params.leadId,
    event_type: 'lead_automation_task_created',
    title: 'CRM создала задачу',
    body: params.title,
    metadata: {
      task_id: task.id,
      automation_key: params.automationKey,
      due_date: dueDate,
      source: params.source,
    },
  })

  return task.id
}

export async function scheduleFirstTouchTask(params: {
  supabase: QueryClient
  actorUserId?: string | null
  leadId: string
  ownerUserId: string
  contactName?: string | null
}) {
  return createLeadAutomationTask({
    supabase: params.supabase,
    actorUserId: params.actorUserId,
    leadId: params.leadId,
    ownerUserId: params.ownerUserId,
    automationKey: 'lead_first_touch',
    title: `Связаться с клиентом${params.contactName ? `: ${params.contactName}` : ''}`,
    description: 'CRM поставила задачу после взятия лида в работу. Уточните интерес, бюджет, даты и следующий шаг.',
    priority: 'high',
    dueInHours: 2,
    source: 'lead_taken',
  })
}

export async function scheduleOutboundFollowupTask(params: {
  supabase: QueryClient
  actorUserId?: string | null
  leadId: string
  ownerUserId?: string | null
  channel: string
}) {
  return createLeadAutomationTask({
    supabase: params.supabase,
    actorUserId: params.actorUserId,
    leadId: params.leadId,
    ownerUserId: params.ownerUserId,
    automationKey: 'lead_outbound_followup',
    title: 'Проверить ответ клиента',
    description: `CRM поставила follow-up после исходящего сообщения (${params.channel}). Если клиент не ответил, сделайте касание другим каналом.`,
    priority: 'medium',
    dueInHours: 24,
    source: 'lead_outbound_message',
  })
}

export async function scheduleInboundReplyTask(params: {
  supabase: QueryClient
  actorUserId?: string | null
  leadId: string
  ownerUserId?: string | null
  channel: string
}) {
  return createLeadAutomationTask({
    supabase: params.supabase,
    actorUserId: params.actorUserId,
    leadId: params.leadId,
    ownerUserId: params.ownerUserId,
    automationKey: 'lead_inbound_reply',
    title: 'Ответить клиенту',
    description: `Клиент написал входящее сообщение (${params.channel}). Подготовьте ответ и зафиксируйте следующий шаг.`,
    priority: 'high',
    dueInHours: 1,
    source: 'lead_inbound_message',
  })
}
