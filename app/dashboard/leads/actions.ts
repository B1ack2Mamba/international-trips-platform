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

  await supabase.from('leads').update({
    status,
    owner_user_id: current?.owner_user_id ?? user!.id,
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
  const basePath = current?.owner_user_id ? '/dashboard/my-leads' : '/dashboard/leads'

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
