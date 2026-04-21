'use server'

import { revalidatePath } from 'next/cache'
import { requireAbility } from '@/lib/auth'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function createSalesScript(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/scripts', 'script.create')

  await supabase.from('sales_scripts').insert({
    segment: value(formData, 'segment') || 'teen',
    stage: value(formData, 'stage') || 'first-call',
    title: value(formData, 'title'),
    body: value(formData, 'body'),
  })

  revalidatePath('/dashboard/scripts')
}
