'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireDashboardAccess } from '@/lib/auth'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function refreshTaskPaths() {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/my-leads')
  revalidatePath('/dashboard/deals')
}

export async function updateTaskStatusAction(formData: FormData) {
  const { supabase, user } = await requireDashboardAccess('/dashboard/tasks')
  const taskId = value(formData, 'task_id')
  const status = value(formData, 'status') || 'done'
  if (!taskId || !['todo', 'doing', 'done', 'cancelled'].includes(status)) return

  const { data: task } = await supabase
    .from('tasks')
    .select('id, title, lead_id, deal_id, application_id')
    .eq('id', taskId)
    .maybeSingle<{ id: string; title: string; lead_id: string | null; deal_id: string | null; application_id: string | null }>()

  await supabase.from('tasks').update({ status }).eq('id', taskId)

  if (task?.lead_id) {
    await supabase.from('activity_log').insert({
      actor_user_id: user!.id,
      entity_type: 'lead',
      entity_id: task.lead_id,
      event_type: 'task_status_changed',
      title: status === 'done' ? 'Задача закрыта' : 'Статус задачи обновлён',
      body: task.title,
      metadata: { task_id: taskId, status },
    })
  }

  if (task?.deal_id) {
    await supabase.from('activity_log').insert({
      actor_user_id: user!.id,
      entity_type: 'deal',
      entity_id: task.deal_id,
      event_type: 'task_status_changed',
      title: status === 'done' ? 'Задача закрыта' : 'Статус задачи обновлён',
      body: task.title,
      metadata: { task_id: taskId, status },
    })
  }

  if (task?.application_id) {
    await supabase.from('activity_log').insert({
      actor_user_id: user!.id,
      entity_type: 'application',
      entity_id: task.application_id,
      event_type: 'task_status_changed',
      title: status === 'done' ? 'Задача закрыта' : 'Статус задачи обновлён',
      body: task.title,
      metadata: { task_id: taskId, status },
    })
  }

  refreshTaskPaths()
  redirect('/dashboard/tasks')
}

export async function createGeneralTaskAction(formData: FormData) {
  const { supabase, user } = await requireDashboardAccess('/dashboard/tasks')
  const title = value(formData, 'title')
  if (!title) return

  const dueDate = value(formData, 'due_date')
  const priority = value(formData, 'priority') || 'medium'

  await supabase.from('tasks').insert({
    owner_user_id: user!.id,
    title,
    description: value(formData, 'description') || null,
    priority: ['low', 'medium', 'high', 'critical'].includes(priority) ? priority : 'medium',
    due_date: dueDate ? new Date(dueDate).toISOString() : null,
    status: 'todo',
    metadata: { source: 'tasks_page' },
  })

  refreshTaskPaths()
  redirect('/dashboard/tasks')
}
