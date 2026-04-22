'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility } from '@/lib/auth'
import { getLeadAssignableProfiles } from '@/lib/lead-access'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function numberValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  return raw ? Number(raw) : null
}

function refreshLeadPaths(leadId?: string) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/my-leads')
  if (leadId) revalidatePath(`/dashboard/leads/${leadId}`)
}

export async function createLead(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/leads', 'lead.create')

  await supabase.from('leads').insert({
    owner_user_id: user!.id,
    contact_name_raw: value(formData, 'contact_name_raw'),
    phone_raw: value(formData, 'phone_raw'),
    email_raw: value(formData, 'email_raw') || null,
    desired_country: value(formData, 'desired_country') || null,
    source_channel: value(formData, 'source_channel') || 'manual',
    status: 'new',
    message: value(formData, 'message') || null,
  })

  refreshLeadPaths()
}

export async function takeLead(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/leads', 'lead.take')
  const leadId = value(formData, 'lead_id')
  const { data: lead, error } = await supabase
    .from('leads')
    .update({
      owner_user_id: user!.id,
      assigned_at: new Date().toISOString(),
      status: 'in_progress',
    })
    .eq('id', leadId)
    .is('owner_user_id', null)
    .is('converted_deal_id', null)
    .select('id, contact_name_raw')
    .maybeSingle<{ id: string; contact_name_raw: string | null }>()

  if (error || !lead) {
    redirect(`/dashboard/leads?error=${encodeURIComponent(error?.message ?? 'Лид уже взят другим менеджером')}`)
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user!.id,
    entity_type: 'lead',
    entity_id: leadId,
    event_type: 'lead_assigned',
    title: 'Лид взят в работу',
    body: lead.contact_name_raw || 'Лид закреплён за менеджером.',
    metadata: { owner_user_id: user!.id },
  })
  refreshLeadPaths(leadId)
  redirect(`/dashboard/my-leads?open=${encodeURIComponent(leadId)}`)
}

export async function updateLeadStatus(formData: FormData) {
  const { supabase, user, profile } = await requireAbility('/dashboard/leads', 'lead.update')
  const leadId = value(formData, 'lead_id')
  const status = value(formData, 'status') || 'new'
  const note = value(formData, 'note') || null
  const nextActionAt = value(formData, 'next_action_at') || null
  const canManageAnyLead = ['owner', 'admin', 'sales_head', 'sales_manager'].includes(profile?.role ?? '')
  const { data: current } = await supabase
    .from('leads')
    .select('owner_user_id')
    .eq('id', leadId)
    .maybeSingle<{ owner_user_id: string | null }>()

  if (current?.owner_user_id && current.owner_user_id !== user!.id && !canManageAnyLead) {
    redirect(`/dashboard/my-leads?error=${encodeURIComponent('Этот лид закреплён за другим менеджером')}`)
  }

  const nextOwnerUserId = status === 'in_progress'
    ? (current?.owner_user_id ?? user!.id)
    : (current?.owner_user_id ?? null)

  await supabase.from('leads').update({
    status,
    owner_user_id: nextOwnerUserId,
    assigned_at: status === 'in_progress' && !current?.owner_user_id ? new Date().toISOString() : undefined,
    qualified_at: status === 'qualified' ? new Date().toISOString() : undefined,
    disqualified_reason: status === 'disqualified' ? note : undefined,
    next_action_at: nextActionAt,
  }).eq('id', leadId)

  await supabase.from('activity_log').insert({
    actor_user_id: user!.id,
    entity_type: 'lead',
    entity_id: leadId,
    event_type: 'lead_status_changed',
    title: 'Статус лида обновлён',
    body: note || `Новый статус: ${status}`,
    metadata: { status, next_action_at: nextActionAt },
  })
  refreshLeadPaths(leadId)
  const basePath = nextOwnerUserId ? '/dashboard/my-leads' : '/dashboard/leads'

  if (status === 'in_progress') {
    redirect(`${basePath}?open=${encodeURIComponent(leadId)}&scripts=1`)
  }
  if (status === 'qualified') {
    redirect(`${basePath}?open=${encodeURIComponent(leadId)}&ready=1`)
  }
  redirect(`${basePath}?open=${encodeURIComponent(leadId)}`)
}

export async function convertLeadToDeal(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/leads', 'lead.convert')
  const leadId = value(formData, 'lead_id')
  const { data, error } = await supabase.rpc('convert_lead_to_deal', {
    p_lead_id: leadId,
    p_title: value(formData, 'title'),
    p_stage: value(formData, 'stage') || 'qualified',
    p_estimated_value: numberValue(formData, 'estimated_value'),
    p_currency: value(formData, 'currency') || 'RUB',
    p_participants_count: Number(value(formData, 'participants_count') || '1'),
    p_close_date: value(formData, 'close_date') || null,
    p_notes: value(formData, 'notes') || null,
    p_create_account: value(formData, 'create_account') === 'on',
  })

  if (error || !data) {
    redirect(`/error?message=${encodeURIComponent(error?.message ?? 'Не удалось конвертировать лид в сделку')}`)
  }

  refreshLeadPaths(leadId)
  revalidatePath('/dashboard/deals')
  redirect(`/dashboard/deals?open=${encodeURIComponent(String(data))}#deal-editor`)
}

export async function transferLeadOwner(formData: FormData) {
  const { supabase, user, profile } = await requireAbility('/dashboard/leads', 'lead.update')
  const leadId = value(formData, 'lead_id')
  const ownerUserId = value(formData, 'owner_user_id')
  const note = value(formData, 'note')
  if (!leadId || !ownerUserId) return

  const canManageAnyLead = ['owner', 'admin', 'sales_head', 'sales_manager'].includes(profile?.role ?? '')
  const { data: lead } = await supabase
    .from('leads')
    .select('owner_user_id')
    .eq('id', leadId)
    .maybeSingle<{ owner_user_id: string | null }>()

  if (lead?.owner_user_id && lead.owner_user_id !== user!.id && !canManageAnyLead) {
    redirect(`/dashboard/my-leads?error=${encodeURIComponent('Передавать можно только свой лид')}`)
  }

  const assignable = await getLeadAssignableProfiles()
  if (!assignable.some((item) => item.id === ownerUserId)) {
    redirect(`/dashboard/my-leads?error=${encodeURIComponent('У выбранного пользователя нет доступа к лидам')}`)
  }

  const { error } = await supabase
    .from('leads')
    .update({
      owner_user_id: ownerUserId,
      assigned_at: new Date().toISOString(),
      status: 'in_progress',
    })
    .eq('id', leadId)

  if (error) {
    redirect(`/dashboard/my-leads?error=${encodeURIComponent(error.message)}`)
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user!.id,
    entity_type: 'lead',
    entity_id: leadId,
    event_type: 'lead_owner_transferred',
    title: 'Лид передан другому менеджеру',
    body: note || 'Ответственный менеджер обновлён.',
    metadata: { owner_user_id: ownerUserId },
  })

  refreshLeadPaths(leadId)
  redirect('/dashboard/my-leads')
}

function fallbackLeadScript(input: {
  name: string
  phone: string
  email: string
  interest: string
  departure: string
  message: string
  channel: string
}) {
  return [
    `1. Начать с контекста: «${input.name}, вижу ваш интерес: ${input.interest}. Правильно понимаю, что сейчас важно подобрать безопасный и понятный вариант?»`,
    `2. Уточнить цель: возраст/количество участников, желаемые даты, бюджетный коридор, что точно нельзя по формату поездки.`,
    `3. Подтвердить доверие: проговорить программу, сопровождение, проживание, документы и следующие шаги без давления.`,
    `4. Закрыть на действие: предложить 2 варианта и договориться о следующем касании сегодня/завтра.`,
    `Данные клиента: телефон ${input.phone || 'не указан'}, email ${input.email || 'не указан'}, выезд ${input.departure || 'не выбран'}, канал ${input.channel}. Комментарий: ${input.message || 'нет'}.`,
  ].join('\n\n')
}

export async function generateLeadScriptAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/leads', 'lead.update')
  const leadId = value(formData, 'lead_id')
  const { data: lead, error } = await supabase
    .from('leads')
    .select(`id, contact_name_raw, phone_raw, email_raw, desired_country, source_channel, source_detail, message, metadata,
      desired_program:programs(title, segment, short_description),
      desired_departure:departures(departure_name, start_date)`)
    .eq('id', leadId)
    .maybeSingle()

  if (error || !lead) {
    redirect(`/dashboard/my-leads?error=${encodeURIComponent(error?.message ?? 'Лид не найден')}`)
  }

  const program = Array.isArray(lead.desired_program) ? (lead.desired_program[0] ?? null) : lead.desired_program
  const departure = Array.isArray(lead.desired_departure) ? (lead.desired_departure[0] ?? null) : lead.desired_departure
  const input = {
    name: String(lead.contact_name_raw || 'Клиент'),
    phone: String(lead.phone_raw || ''),
    email: String(lead.email_raw || ''),
    interest: String(program?.title || lead.desired_country || 'интерес не указан'),
    departure: String(departure?.departure_name || ''),
    message: String(lead.message || ''),
    channel: String(lead.source_channel || ''),
  }

  let script = fallbackLeadScript(input)
  const apiKey = process.env.OPENAI_API_KEY
  if (apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_SCRIPT_MODEL || 'gpt-4.1-mini',
          input: [
            {
              role: 'system',
              content: 'Ты сильный менеджер продаж образовательных поездок. Пиши конкретный персональный скрипт звонка на русском, без общих фраз.',
            },
            {
              role: 'user',
              content: `Составь персональный скрипт для клиента. Имя: ${input.name}. Телефон: ${input.phone}. Email: ${input.email}. Интерес: ${input.interest}. Выезд: ${input.departure}. Канал: ${input.channel}. Комментарий клиента: ${input.message}. Верни структуру: открытие, 5 вопросов, аргументы, следующий шаг.`,
            },
          ],
          max_output_tokens: 900,
        }),
      })
      const json = await response.json() as { output_text?: string; error?: { message?: string } }
      if (response.ok && json.output_text) script = json.output_text
    } catch {
      script = fallbackLeadScript(input)
    }
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user!.id,
    entity_type: 'lead',
    entity_id: leadId,
    event_type: 'ai_sales_script_generated',
    title: 'ИИ-скрипт для клиента',
    body: script,
    metadata: {
      generated_with: apiKey ? 'openai' : 'fallback',
      interest: input.interest,
    },
  })

  refreshLeadPaths(leadId)
  redirect(`/dashboard/my-leads?open=${encodeURIComponent(leadId)}&history=1`)
}

export async function createLeadTaskAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/leads', 'lead.update')
  const leadId = value(formData, 'lead_id')
  const title = value(formData, 'title')
  if (!leadId || !title) return

  const { data: lead } = await supabase
    .from('leads')
    .select('owner_user_id')
    .eq('id', leadId)
    .maybeSingle<{ owner_user_id: string | null }>()

  await supabase.from('tasks').insert({
    owner_user_id: lead?.owner_user_id || user!.id,
    lead_id: leadId,
    title,
    description: value(formData, 'description') || null,
    status: 'todo',
    priority: value(formData, 'priority') || 'medium',
    due_date: value(formData, 'due_date') ? new Date(value(formData, 'due_date')).toISOString() : null,
    metadata: { created_from: 'lead_panel' },
  })

  await supabase.from('activity_log').insert({
    actor_user_id: user!.id,
    entity_type: 'lead',
    entity_id: leadId,
    event_type: 'lead_task_created',
    title: 'Создано следующее действие',
    body: title,
    metadata: { due_date: value(formData, 'due_date') || null },
  })

  refreshLeadPaths(leadId)
  redirect(`/dashboard/my-leads?open=${encodeURIComponent(leadId)}`)
}

export async function createLeadNoteAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/leads', 'lead.update')
  const leadId = value(formData, 'lead_id')
  const note = value(formData, 'note')
  if (!leadId || !note) return

  await supabase.from('activity_log').insert({
    actor_user_id: user!.id,
    entity_type: 'lead',
    entity_id: leadId,
    event_type: 'lead_note_added',
    title: value(formData, 'title') || 'Комментарий менеджера',
    body: note,
    metadata: { source: 'lead_timeline' },
  })

  refreshLeadPaths(leadId)
  redirect(`/dashboard/my-leads?open=${encodeURIComponent(leadId)}&history=1#lead-history`)
}

export async function completeLeadTaskAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/leads', 'lead.update')
  const leadId = value(formData, 'lead_id')
  const taskId = value(formData, 'task_id')
  if (!taskId) return

  await supabase.from('tasks').update({ status: 'done' }).eq('id', taskId)
  if (leadId) {
    await supabase.from('activity_log').insert({
      actor_user_id: user!.id,
      entity_type: 'lead',
      entity_id: leadId,
      event_type: 'lead_task_done',
      title: 'Задача закрыта',
      body: value(formData, 'title') || 'Следующее действие выполнено.',
      metadata: { task_id: taskId },
    })
    refreshLeadPaths(leadId)
    redirect(`/dashboard/my-leads?open=${encodeURIComponent(leadId)}`)
  }
}
