'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility } from '@/lib/auth'
import { closeDealAutomationTasks, scheduleDealPaymentTask } from '@/lib/deal-automation'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function optionalValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  return raw || null
}

function refreshContractPaths(contractId?: string, applicationId?: string) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/contracts')
  revalidatePath('/dashboard/applications')
  revalidatePath('/dashboard/deals')
  if (contractId) revalidatePath(`/dashboard/contracts/${contractId}`)
  if (applicationId) revalidatePath(`/dashboard/applications/${applicationId}`)
}

export async function createContractForDealAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/contracts', 'application.contract_create')
  const dealId = value(formData, 'deal_id')
  const templateCode = value(formData, 'template_code') || 'family_standard'

  let applicationId: string | null = null
  const existing = await supabase
    .from('applications')
    .select('id')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  applicationId = existing.data?.id ?? null

  if (!applicationId) {
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select(`id, title, estimated_value, close_date,
        lead:leads!deals_lead_id_fkey(contact_name_raw, phone_raw, email_raw)`)
      .eq('id', dealId)
      .maybeSingle()

    if (dealError || !deal) {
      redirect(`/dashboard/contracts?deal_id=${encodeURIComponent(dealId)}&error=${encodeURIComponent(dealError?.message ?? 'Сделка не найдена')}`)
    }

    const lead = Array.isArray(deal.lead) ? (deal.lead[0] ?? null) : deal.lead
    const created = await supabase.rpc('create_application_from_deal', {
      p_deal_id: dealId,
      p_participant_name: lead?.contact_name_raw?.trim() || deal.title?.trim() || 'Участник из сделки',
      p_guardian_name: lead?.contact_name_raw?.trim() || null,
      p_guardian_phone: lead?.phone_raw?.trim() || null,
      p_guardian_email: lead?.email_raw?.trim() || null,
      p_amount_total: Number(deal.estimated_value ?? 0) || null,
      p_due_date: deal.close_date || null,
      p_payment_label: 'Оплата по договору',
      p_payment_amount: null,
      p_create_payment: false,
    })

    if (created.error || !created.data) {
      redirect(`/dashboard/contracts?deal_id=${encodeURIComponent(dealId)}&error=${encodeURIComponent(created.error?.message ?? 'Не удалось подготовить договор')}`)
    }
    applicationId = String(created.data)
  }

  const { data: existingContract } = await supabase
    .from('contracts')
    .select('id')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (existingContract?.id) {
    refreshContractPaths(existingContract.id, applicationId)
    redirect(`/dashboard/contracts/${existingContract.id}`)
  }

  const { data: contractId, error } = await supabase.rpc('create_contract_from_application', {
    p_application_id: applicationId,
    p_template_code: templateCode,
    p_mark_ready: value(formData, 'mark_ready') === 'on',
  })

  if (error || !contractId) {
    redirect(`/dashboard/contracts?deal_id=${encodeURIComponent(dealId)}&error=${encodeURIComponent(error?.message ?? 'Не удалось создать договор')}`)
  }

  await closeDealAutomationTasks({
    supabase,
    dealId,
    automationKeys: ['deal_prepare_contract'],
  })

  refreshContractPaths(String(contractId), applicationId)
  redirect(`/dashboard/contracts/${contractId}`)
}

export async function updateContractStatusAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/contracts', 'contract.status_update')
  const contractId = value(formData, 'contract_id')
  const applicationId = optionalValue(formData, 'application_id')
  const status = value(formData, 'status')
  await supabase.rpc('mark_contract_status', {
    p_contract_id: contractId,
    p_status: status,
    p_note: optionalValue(formData, 'note'),
    p_signatory_name: optionalValue(formData, 'signatory_name'),
    p_signatory_email: optionalValue(formData, 'signatory_email'),
  })

  if (status === 'signed') {
    const { data: contract } = await supabase
      .from('contracts')
      .select(`deal_id, deal:deals!contracts_deal_id_fkey(id, owner_user_id, lead_id, estimated_value, currency)`)
      .eq('id', contractId)
      .maybeSingle<{
        deal_id: string | null
        deal: { id: string; owner_user_id: string | null; lead_id: string | null; estimated_value: number | null; currency: string | null } | null
      }>()

    const deal = Array.isArray(contract?.deal) ? (contract?.deal[0] ?? null) : contract?.deal
    if (contract?.deal_id) {
      await closeDealAutomationTasks({
        supabase,
        dealId: contract.deal_id,
        automationKeys: ['deal_prepare_contract'],
      })
      await scheduleDealPaymentTask({
        supabase,
        actorUserId: user?.id ?? null,
        dealId: contract.deal_id,
        leadId: deal?.lead_id ?? null,
        ownerUserId: deal?.owner_user_id ?? user?.id ?? null,
        amount: Number(deal?.estimated_value ?? 0),
        currency: deal?.currency ?? 'RUB',
      })
    }
  }

  refreshContractPaths(contractId, applicationId || undefined)
}
