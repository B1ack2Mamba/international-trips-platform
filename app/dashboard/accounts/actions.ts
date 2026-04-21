'use server'

import { revalidatePath } from 'next/cache'
import { requireAbility } from '@/lib/auth'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function createAccount(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/accounts', 'account.create')

  await supabase.from('accounts').insert({
    owner_user_id: user!.id,
    display_name: value(formData, 'display_name'),
    account_type: value(formData, 'account_type') || 'family',
    city: value(formData, 'city'),
    country: value(formData, 'country'),
    website_url: value(formData, 'website_url') || null,
    notes: value(formData, 'notes'),
    status: 'active',
  })

  revalidatePath('/dashboard/accounts')
}
