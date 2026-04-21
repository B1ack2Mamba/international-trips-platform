'use server'

import { revalidatePath } from 'next/cache'
import { requireAbility } from '@/lib/auth'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function createProgram(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/programs', 'program.create')

  await supabase.from('programs').insert({
    code: value(formData, 'code'),
    title: value(formData, 'title'),
    country: value(formData, 'country'),
    city: value(formData, 'city'),
    segment: value(formData, 'segment'),
    trip_type: value(formData, 'trip_type'),
    language: value(formData, 'language'),
    duration_days: Number(value(formData, 'duration_days') || 14),
    public_slug: value(formData, 'public_slug'),
    short_description: value(formData, 'short_description'),
    description: value(formData, 'description'),
    is_active: true,
  })

  revalidatePath('/dashboard/programs')
  revalidatePath('/programs')
}
