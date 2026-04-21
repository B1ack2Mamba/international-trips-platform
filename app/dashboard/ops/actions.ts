'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAbility } from '@/lib/auth'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function refreshOpsPaths(departureId?: string) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/ops')
  revalidatePath('/dashboard/reports')
  if (departureId) revalidatePath(`/dashboard/ops/${departureId}`)
}

const defaultChecklist = [
  { category: 'group', title: 'Подтвердить финальный состав группы', priority: 'high', sort_order: 10 },
  { category: 'documents', title: 'Проверить документы и согласия', priority: 'high', sort_order: 20 },
  { category: 'visa', title: 'Проверить визовый пакет', priority: 'high', sort_order: 30 },
  { category: 'flights', title: 'Сверить перелёты и трансферы', priority: 'high', sort_order: 40 },
  { category: 'hotel', title: 'Подтвердить проживание и размещение', priority: 'medium', sort_order: 50 },
  { category: 'insurance', title: 'Проверить страховки', priority: 'medium', sort_order: 60 },
  { category: 'briefing', title: 'Провести брифинг для родителей и участников', priority: 'high', sort_order: 70 },
  { category: 'safety', title: 'Подготовить emergency pack и контакты', priority: 'critical', sort_order: 80 },
]

export async function seedDepartureOpsChecklistAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/ops', 'ops.checklist_seed')
  const departureId = value(formData, 'departure_id')

  const rows = defaultChecklist.map((item) => ({
    departure_id: departureId,
    owner_user_id: user!.id,
    category: item.category,
    title: item.title,
    priority: item.priority,
    sort_order: item.sort_order,
    status: 'todo',
  }))

  if (rows.length) {
    const { error } = await supabase.from('departure_ops_items').insert(rows)
    if (error) redirect(`/error?message=${encodeURIComponent(error.message)}`)
  }

  await supabase.from('activity_log').insert({
    actor_user_id: user!.id,
    entity_type: 'departure',
    entity_id: departureId,
    event_type: 'ops_checklist_seeded',
    title: 'Создан базовый ops-чеклист',
    body: 'Trip Ops контур инициализирован для выезда.',
    metadata: { inserted_count: rows.length },
  })

  refreshOpsPaths(departureId)
}

export async function createDepartureOpsItemAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/ops', 'ops.item_create')
  const departureId = value(formData, 'departure_id')

  const { error } = await supabase.from('departure_ops_items').insert({
    departure_id: departureId,
    application_id: value(formData, 'application_id') || null,
    owner_user_id: user!.id,
    category: value(formData, 'category') || 'other',
    title: value(formData, 'title'),
    description: value(formData, 'description') || null,
    status: value(formData, 'status') || 'todo',
    priority: value(formData, 'priority') || 'medium',
    due_at: value(formData, 'due_at') || null,
    sort_order: Number(value(formData, 'sort_order') || 100),
  })

  if (error) redirect(`/error?message=${encodeURIComponent(error.message)}`)
  refreshOpsPaths(departureId)
}

export async function updateDepartureOpsItemAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/ops', 'ops.item_update')
  const itemId = value(formData, 'item_id')
  const departureId = value(formData, 'departure_id')
  const note = value(formData, 'note')

  const { error } = await supabase
    .from('departure_ops_items')
    .update({
      status: value(formData, 'status') || 'todo',
      priority: value(formData, 'priority') || 'medium',
      due_at: value(formData, 'due_at') || null,
      metadata: note ? { last_note: note } : undefined,
    })
    .eq('id', itemId)

  if (error) redirect(`/error?message=${encodeURIComponent(error.message)}`)

  await supabase.from('activity_log').insert({
    actor_user_id: user!.id,
    entity_type: 'departure',
    entity_id: departureId,
    event_type: 'ops_item_updated',
    title: 'Обновлён ops-пункт',
    body: note || 'Статус пункта обновлён',
    metadata: {
      item_id: itemId,
      status: value(formData, 'status') || 'todo',
    },
  })

  refreshOpsPaths(departureId)
}

export async function createTripUpdateAction(formData: FormData) {
  const { supabase, user } = await requireAbility('/dashboard/ops', 'ops.update_create')
  const departureId = value(formData, 'departure_id')

  const { error } = await supabase.from('trip_updates').insert({
    departure_id: departureId,
    application_id: value(formData, 'application_id') || null,
    author_user_id: user!.id,
    audience: value(formData, 'audience') || 'internal',
    title: value(formData, 'title'),
    body: value(formData, 'body'),
    is_published: value(formData, 'is_published') === 'on',
    published_at: value(formData, 'is_published') === 'on' ? new Date().toISOString() : null,
  })

  if (error) redirect(`/error?message=${encodeURIComponent(error.message)}`)
  refreshOpsPaths(departureId)
}
