type QueryClient = {
  from: (table: string) => any
}

function addHours(hours: number) {
  const date = new Date()
  date.setHours(date.getHours() + hours)
  return date.toISOString()
}

async function hasOpenDealAutomationTask(supabase: QueryClient, dealId: string, automationKey: string) {
  const { data } = await supabase
    .from('tasks')
    .select('id')
    .eq('deal_id', dealId)
    .in('status', ['todo', 'doing'])
    .contains('metadata', { automation_key: automationKey })
    .limit(1)
    .maybeSingle()

  return Boolean((data as { id?: string } | null)?.id)
}

export async function createDealAutomationTask(params: {
  supabase: QueryClient
  actorUserId?: string | null
  dealId: string
  leadId?: string | null
  ownerUserId?: string | null
  automationKey: string
  title: string
  description?: string | null
  priority?: 'low' | 'medium' | 'high' | 'critical'
  dueInHours?: number
  source: string
}) {
  if (await hasOpenDealAutomationTask(params.supabase, params.dealId, params.automationKey)) {
    return null
  }

  const dueDate = addHours(params.dueInHours ?? 24)
  const { data, error } = await params.supabase
    .from('tasks')
    .insert({
      owner_user_id: params.ownerUserId ?? null,
      lead_id: params.leadId ?? null,
      deal_id: params.dealId,
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
  if (error || !task?.id) return null

  await params.supabase.from('activity_log').insert({
    actor_user_id: params.actorUserId ?? null,
    entity_type: 'deal',
    entity_id: params.dealId,
    event_type: 'deal_automation_task_created',
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

export async function scheduleDealContractTask(params: {
  supabase: QueryClient
  actorUserId?: string | null
  dealId: string
  leadId?: string | null
  ownerUserId?: string | null
  dealTitle?: string | null
}) {
  return createDealAutomationTask({
    supabase: params.supabase,
    actorUserId: params.actorUserId,
    dealId: params.dealId,
    leadId: params.leadId,
    ownerUserId: params.ownerUserId,
    automationKey: 'deal_prepare_contract',
    title: 'Подготовить договор',
    description: `Сформируйте договор по сделке${params.dealTitle ? ` «${params.dealTitle}»` : ''} и отправьте клиенту на подпись.`,
    priority: 'high',
    dueInHours: 6,
    source: 'deal_contract_flow',
  })
}

export async function scheduleDealPaymentTask(params: {
  supabase: QueryClient
  actorUserId?: string | null
  dealId: string
  leadId?: string | null
  ownerUserId?: string | null
  amount?: number | null
  currency?: string | null
}) {
  const amountLine = params.amount && params.amount > 0 ? ` Сумма к оплате: ${params.amount} ${params.currency || 'RUB'}.` : ''
  return createDealAutomationTask({
    supabase: params.supabase,
    actorUserId: params.actorUserId,
    dealId: params.dealId,
    leadId: params.leadId,
    ownerUserId: params.ownerUserId,
    automationKey: 'deal_collect_payment',
    title: 'Проконтролировать оплату',
    description: `Договор подписан или оплата началась.${amountLine} Зафиксируйте поступление и следующий шаг.`,
    priority: 'high',
    dueInHours: 24,
    source: 'deal_payment_flow',
  })
}

export async function scheduleDealApplicationTask(params: {
  supabase: QueryClient
  actorUserId?: string | null
  dealId: string
  leadId?: string | null
  ownerUserId?: string | null
}) {
  return createDealAutomationTask({
    supabase: params.supabase,
    actorUserId: params.actorUserId,
    dealId: params.dealId,
    leadId: params.leadId,
    ownerUserId: params.ownerUserId,
    automationKey: 'deal_create_application',
    title: 'Передать клиента в участники',
    description: 'Оплата закрыта. Создайте участника выезда и проверьте документы/операционные шаги.',
    priority: 'critical',
    dueInHours: 4,
    source: 'deal_application_flow',
  })
}

export async function closeDealAutomationTasks(params: {
  supabase: QueryClient
  dealId: string
  automationKeys: string[]
}) {
  if (!params.automationKeys.length) return

  for (const automationKey of params.automationKeys) {
    await params.supabase
      .from('tasks')
      .update({ status: 'done' })
      .eq('deal_id', params.dealId)
      .in('status', ['todo', 'doing'])
      .contains('metadata', { automation_key: automationKey })
  }
}
