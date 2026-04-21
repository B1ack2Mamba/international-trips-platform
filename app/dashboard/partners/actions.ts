'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility } from '@/lib/auth'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function refreshPartnerPaths() {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/leads')
  revalidatePath('/dashboard/deals')
  revalidatePath('/dashboard/applications')
  revalidatePath('/dashboard/partners')
  revalidatePath('/dashboard/reports')
}

export async function createPartnerCodeAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/partners', 'partner.code_create')
  const code = value(formData, 'code').toLowerCase()
  const partnerAccountId = value(formData, 'partner_account_id')
  const commissionPctRaw = value(formData, 'commission_pct')
  const lockDaysRaw = value(formData, 'lock_days')

  const { error } = await supabase.from('partner_referral_codes').insert({
    partner_account_id: partnerAccountId,
    code,
    label: value(formData, 'label'),
    status: value(formData, 'status') || 'active',
    lock_days: lockDaysRaw ? Number(lockDaysRaw) : 180,
    commission_pct: commissionPctRaw ? Number(commissionPctRaw) : null,
    landing_path: value(formData, 'landing_path') || '/programs',
    metadata: {
      source: 'dashboard_partners_create_code',
    },
  })

  if (error) {
    redirect(`/error?message=${encodeURIComponent(error.message)}`)
  }

  refreshPartnerPaths()
}

export async function bindLeadToPartnerAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/partners', 'partner.bind')
  const leadId = value(formData, 'lead_id')
  const code = value(formData, 'code').toLowerCase()
  const note = value(formData, 'note')

  const { data: codeRow, error: codeError } = await supabase
    .from('partner_referral_codes')
    .select('id, code, label, lock_days, partner_account_id')
    .eq('code', code)
    .eq('status', 'active')
    .maybeSingle()

  if (codeError || !codeRow) {
    redirect(`/error?message=${encodeURIComponent(codeError?.message ?? 'partner_code_not_found')}`)
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, converted_deal_id')
    .eq('id', leadId)
    .maybeSingle()

  if (leadError || !lead) {
    redirect(`/error?message=${encodeURIComponent(leadError?.message ?? 'lead_not_found')}`)
  }

  const ownershipLockedUntil = new Date(Date.now() + codeRow.lock_days * 24 * 60 * 60_000).toISOString()
  const ownershipNote = note || `Привязано вручную через код ${codeRow.code}`

  const { error: updateLeadError } = await supabase
    .from('leads')
    .update({
      source_channel: 'partner',
      source_detail: codeRow.code,
      partner_account_id: codeRow.partner_account_id,
      partner_referral_code_id: codeRow.id,
      ownership_lock_status: 'partner_owned',
      ownership_locked_until: ownershipLockedUntil,
      ownership_note: ownershipNote,
    })
    .eq('id', lead.id)

  if (updateLeadError) {
    redirect(`/error?message=${encodeURIComponent(updateLeadError.message)}`)
  }

  if (lead.converted_deal_id) {
    await supabase
      .from('deals')
      .update({
        partner_account_id: codeRow.partner_account_id,
        partner_referral_code_id: codeRow.id,
        ownership_lock_status: 'partner_owned',
        ownership_locked_until: ownershipLockedUntil,
        ownership_note: ownershipNote,
      })
      .eq('id', lead.converted_deal_id)

    await supabase
      .from('applications')
      .update({ partner_account_id: codeRow.partner_account_id })
      .eq('deal_id', lead.converted_deal_id)
  }

  await supabase.from('activity_log').insert([
    {
      actor_user_id: user!.id,
      entity_type: 'lead',
      entity_id: lead.id,
      event_type: 'partner_bound',
      title: 'Лид привязан к партнёру',
      body: ownershipNote,
      metadata: {
        partner_account_id: codeRow.partner_account_id,
        partner_referral_code_id: codeRow.id,
        code: codeRow.code,
      },
    },
    ...(lead.converted_deal_id
      ? [
          {
            actor_user_id: user!.id,
            entity_type: 'deal',
            entity_id: lead.converted_deal_id,
            event_type: 'partner_bound',
            title: 'Сделка привязана к партнёру',
            body: ownershipNote,
            metadata: {
              partner_account_id: codeRow.partner_account_id,
              partner_referral_code_id: codeRow.id,
              code: codeRow.code,
            },
          },
        ]
      : []),
  ])

  refreshPartnerPaths()
}

export async function releasePartnerLockAction(formData: FormData) {
  const { supabase, profile, user } = await requireAbility('/dashboard/partners', 'partner.lock_release')
  if (!profile || !['owner', 'admin'].includes(profile.role ?? '')) {
    redirect('/unauthorized')
  }

  const entityType = value(formData, 'entity_type')
  const entityId = value(formData, 'entity_id')
  const note = value(formData, 'note') || 'Партнёрский lock снят вручную'

  if (entityType === 'lead') {
    await supabase
      .from('leads')
      .update({
        ownership_lock_status: 'released',
        ownership_locked_until: null,
        ownership_note: note,
      })
      .eq('id', entityId)
  }

  if (entityType === 'deal') {
    await supabase
      .from('deals')
      .update({
        ownership_lock_status: 'released',
        ownership_locked_until: null,
        ownership_note: note,
      })
      .eq('id', entityId)
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user!.id,
    entity_type: entityType,
    entity_id: entityId,
    event_type: 'partner_lock_released',
    title: 'Партнёрский lock снят',
    body: note,
    metadata: {
      released_by_role: profile.role,
    },
  })

  refreshPartnerPaths()
}
