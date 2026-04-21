'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility } from '@/lib/auth'

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
  const { supabase } = await requireAbility('/dashboard/leads', 'lead.take')
  const leadId = value(formData, 'lead_id')
  await supabase.rpc('assign_lead_to_self', { p_lead_id: leadId })

  const { data: lead } = await supabase
    .from('leads')
    .select('id, converted_deal_id, contact_name_raw, desired_country, desired_program:programs(title)')
    .eq('id', leadId)
    .maybeSingle<{
      id: string
      converted_deal_id: string | null
      contact_name_raw: string | null
      desired_country: string | null
      desired_program: { title: string | null } | { title: string | null }[] | null
    }>()

  if (lead?.converted_deal_id) {
    refreshLeadPaths(leadId)
    revalidatePath('/dashboard/deals')
    redirect(`/dashboard/deals?open=${encodeURIComponent(String(lead.converted_deal_id))}`)
  }

  const desiredProgram = Array.isArray(lead?.desired_program) ? (lead?.desired_program[0] ?? null) : (lead?.desired_program ?? null)
  const desiredProgramTitle = desiredProgram?.title || ''
  const title = [lead?.desired_country, desiredProgramTitle, lead?.contact_name_raw].filter(Boolean).join(' · ') || 'Сделка из лида'

  const { data: dealId, error } = await supabase.rpc('convert_lead_to_deal', {
    p_lead_id: leadId,
    p_title: title,
    p_stage: 'qualified',
    p_estimated_value: null,
    p_currency: 'RUB',
    p_participants_count: 1,
    p_close_date: null,
    p_notes: 'Сделка автоматически создана из кнопки «Взять».',
    p_create_account: false,
  })

  refreshLeadPaths(leadId)
  revalidatePath('/dashboard/deals')

  if (error || !dealId) {
    redirect(`/dashboard/deals?error=${encodeURIComponent(error?.message ?? 'Лид взят, но сделка не создалась')}`)
  }

  redirect(`/dashboard/deals?created=${encodeURIComponent(String(dealId))}&open=${encodeURIComponent(String(dealId))}`)
}

export async function updateLeadStatus(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/leads', 'lead.update')
  const leadId = value(formData, 'lead_id')
  const status = value(formData, 'status') || 'new'
  await supabase.rpc('update_lead_status', {
    p_lead_id: leadId,
    p_status: status,
    p_note: value(formData, 'note') || null,
    p_next_action_at: value(formData, 'next_action_at') || null,
  })
  refreshLeadPaths(leadId)

  if (status === 'in_progress') {
    redirect(`/dashboard/leads?open=${encodeURIComponent(leadId)}&scripts=1`)
  }
  if (status === 'qualified') {
    redirect(`/dashboard/leads?open=${encodeURIComponent(leadId)}&ready=1`)
  }
  redirect(`/dashboard/leads?open=${encodeURIComponent(leadId)}`)
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
  redirect(`/dashboard/deals/${data}`)
}
