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

function numberValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function refreshDeparturePaths(departureId?: string | null) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/departures')
  revalidatePath('/dashboard/applications')
  revalidatePath('/dashboard/ops')
  revalidatePath('/dashboard/controlling')
  revalidatePath('/dashboard/reports')
  revalidatePath('/programs')
  if (departureId) {
    revalidatePath(`/dashboard/departures/${departureId}`)
    revalidatePath(`/dashboard/ops/${departureId}`)
    revalidatePath(`/dashboard/applications?departure_id=${departureId}`)
  }
}

export async function createDeparture(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/departures', 'departure.create')

  await supabase.from('departures').insert({
    program_id: value(formData, 'program_id'),
    departure_name: value(formData, 'departure_name'),
    city: optionalValue(formData, 'city'),
    start_date: value(formData, 'start_date'),
    end_date: value(formData, 'end_date'),
    application_deadline: optionalValue(formData, 'application_deadline'),
    seat_capacity: numberValue(formData, 'seat_capacity') ?? 0,
    status: value(formData, 'status') || 'draft',
    base_price: numberValue(formData, 'base_price') ?? 0,
    currency: value(formData, 'currency') || 'RUB',
  })

  refreshDeparturePaths()
}

export async function updateDepartureAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/departures', 'departure.update')
  const departureId = value(formData, 'departure_id')

  const payload = {
    departure_name: value(formData, 'departure_name'),
    city: optionalValue(formData, 'city'),
    start_date: value(formData, 'start_date'),
    end_date: value(formData, 'end_date'),
    application_deadline: optionalValue(formData, 'application_deadline'),
    seat_capacity: numberValue(formData, 'seat_capacity') ?? 0,
    status: value(formData, 'status') || 'draft',
    base_price: numberValue(formData, 'base_price') ?? 0,
    currency: value(formData, 'currency') || 'RUB',
  }

  const { error } = await supabase.from('departures').update(payload).eq('id', departureId)
  if (error) {
    throw new Error(error.message)
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user?.id ?? null,
    entity_type: 'departure',
    entity_id: departureId,
    event_type: 'departure_updated',
    title: 'Обновлён контекст выезда',
    body: payload.departure_name,
    metadata: payload,
  })

  refreshDeparturePaths(departureId)
}
