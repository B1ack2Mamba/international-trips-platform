'use server'

import { revalidatePath } from 'next/cache'
import { requireAbility } from '@/lib/auth'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function maybeValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  return raw || null
}

function revalidateControlling() {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/finance')
  revalidatePath('/dashboard/controlling')
  revalidatePath('/dashboard/reports')
  revalidatePath('/dashboard/departures')
}

export async function createControllingExpenseAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/controlling', 'controlling.expense_create')

  await supabase.from('controlling_expenses').insert({
    created_by_user_id: user!.id,
    departure_id: maybeValue(formData, 'departure_id'),
    title: value(formData, 'title'),
    category: maybeValue(formData, 'category') ?? 'other',
    expense_kind: value(formData, 'expense_kind') || 'operating',
    expense_nature: value(formData, 'expense_nature') || 'variable',
    scope_type: value(formData, 'scope_type') || 'company',
    amount: Number(value(formData, 'amount') || 0),
    currency: value(formData, 'currency') || 'RUB',
    recognized_on: value(formData, 'recognized_on') || new Date().toISOString().slice(0, 10),
    status: value(formData, 'status') || 'active',
    notes: maybeValue(formData, 'notes'),
  })

  revalidateControlling()
}

export async function updateControllingExpenseStatusAction(formData: FormData) {
  const { supabase } = await requireAbility('/dashboard/controlling', 'controlling.expense_update')

  await supabase
    .from('controlling_expenses')
    .update({
      status: value(formData, 'status') || 'active',
      notes: maybeValue(formData, 'notes'),
    })
    .eq('id', value(formData, 'expense_id'))

  revalidateControlling()
}
