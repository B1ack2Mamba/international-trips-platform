'use server'

import { revalidatePath } from 'next/cache'
import { requireAbility } from '@/lib/auth'

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
  if (contractId) revalidatePath(`/dashboard/contracts/${contractId}`)
  if (applicationId) revalidatePath(`/dashboard/applications/${applicationId}`)
}

export async function updateContractStatusAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/contracts', 'contract.status_update')
  const contractId = value(formData, 'contract_id')
  const applicationId = optionalValue(formData, 'application_id')
  await supabase.rpc('mark_contract_status', {
    p_contract_id: contractId,
    p_status: value(formData, 'status'),
    p_note: optionalValue(formData, 'note'),
    p_signatory_name: optionalValue(formData, 'signatory_name'),
    p_signatory_email: optionalValue(formData, 'signatory_email'),
  })
  refreshContractPaths(contractId, applicationId || undefined)
}
