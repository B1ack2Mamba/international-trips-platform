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

export async function createAccountContact(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/accounts', 'account.create')
  const accountId = value(formData, 'account_id')

  if (!accountId) return

  await supabase.from('contacts').insert({
    account_id: accountId,
    first_name: value(formData, 'first_name') || 'Контакт',
    last_name: value(formData, 'last_name') || null,
    role_label: value(formData, 'role_label') || null,
    phone: value(formData, 'phone') || null,
    email: value(formData, 'email') || null,
    telegram_username: value(formData, 'telegram_username') || null,
    is_primary: formData.get('is_primary') === 'on',
    notes: value(formData, 'notes') || null,
  })

  revalidatePath('/dashboard/accounts')
}

export async function updateAccountStatus(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/accounts', 'account.create')
  const accountId = value(formData, 'account_id')
  const status = value(formData, 'status')

  if (!accountId || !['active', 'inactive', 'archived'].includes(status)) return

  await supabase.from('accounts').update({ status }).eq('id', accountId)

  revalidatePath('/dashboard/accounts')
}
