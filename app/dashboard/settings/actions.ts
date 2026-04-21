'use server'

import { revalidatePath } from 'next/cache'
import { requireAbility } from '@/lib/auth'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/settings', 'settings.profile_update')

  await supabase
    .from('profiles')
    .update({
      full_name: value(formData, 'full_name'),
      phone: value(formData, 'phone') || null,
      locale: value(formData, 'locale') || 'ru',
      timezone: value(formData, 'timezone') || 'Europe/Moscow',
    })
    .eq('id', user!.id)

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard', 'layout')
}
