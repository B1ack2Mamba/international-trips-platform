'use server'

import { revalidatePath } from 'next/cache'
import { requireDashboardAccess } from '@/lib/auth'
import { STARTER_WORKSPACE_TEMPLATES } from '@/lib/influence-spaces'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function integer(formData: FormData, key: string, fallback = 100) {
  const raw = Number(value(formData, key))
  return Number.isFinite(raw) ? raw : fallback
}

function truthy(formData: FormData, key: string) {
  return value(formData, key) === 'on' || value(formData, key) === 'true' || value(formData, key) === '1'
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

async function refreshPaths() {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/spaces')
}

export async function createWorkspaceSpace(formData: FormData) {
  const { supabase, user } = await requireDashboardAccess('/dashboard/spaces')
  const name = value(formData, 'name')
  if (!name) return

  const slug = slugify(value(formData, 'slug') || name)
  await supabase.from('workspace_spaces').insert({
    name,
    slug,
    description: value(formData, 'description') || null,
    color: value(formData, 'color') || '#7dd3fc',
    sort_order: integer(formData, 'sort_order', 100),
    created_by_user_id: user!.id,
  })

  await refreshPaths()
}

export async function updateWorkspaceSpace(formData: FormData) {
  const { supabase } = await requireDashboardAccess('/dashboard/spaces')
  const id = value(formData, 'id')
  if (!id) return

  const name = value(formData, 'name')
  await supabase
    .from('workspace_spaces')
    .update({
      name,
      slug: slugify(value(formData, 'slug') || name),
      description: value(formData, 'description') || null,
      color: value(formData, 'color') || '#7dd3fc',
      sort_order: integer(formData, 'sort_order', 100),
      is_active: truthy(formData, 'is_active'),
    })
    .eq('id', id)

  await refreshPaths()
}

export async function deleteWorkspaceSpace(formData: FormData) {
  const { supabase } = await requireDashboardAccess('/dashboard/spaces')
  const id = value(formData, 'id')
  if (!id) return

  await supabase.from('workspace_spaces').delete().eq('id', id)
  await refreshPaths()
}

export async function addModuleToSpace(formData: FormData) {
  const { supabase } = await requireDashboardAccess('/dashboard/spaces')
  const spaceId = value(formData, 'space_id')
  const moduleKey = value(formData, 'module_key')
  if (!spaceId || !moduleKey) return

  await supabase.from('workspace_space_modules').upsert(
    {
      space_id: spaceId,
      module_key: moduleKey,
      sort_order: integer(formData, 'sort_order', 100),
      is_visible: true,
      notes: value(formData, 'notes') || null,
    },
    { onConflict: 'space_id,module_key' },
  )

  await refreshPaths()
}

export async function updateModuleInSpace(formData: FormData) {
  const { supabase } = await requireDashboardAccess('/dashboard/spaces')
  const id = value(formData, 'id')
  if (!id) return

  await supabase
    .from('workspace_space_modules')
    .update({
      sort_order: integer(formData, 'sort_order', 100),
      is_visible: truthy(formData, 'is_visible'),
      notes: value(formData, 'notes') || null,
    })
    .eq('id', id)

  await refreshPaths()
}

export async function removeModuleFromSpace(formData: FormData) {
  const { supabase } = await requireDashboardAccess('/dashboard/spaces')
  const id = value(formData, 'id')
  if (!id) return
  await supabase.from('workspace_space_modules').delete().eq('id', id)
  await refreshPaths()
}

export async function addWorkspaceLink(formData: FormData) {
  const { supabase } = await requireDashboardAccess('/dashboard/spaces')
  const fromKey = value(formData, 'from_module_key')
  const toKey = value(formData, 'to_module_key')
  if (!fromKey || !toKey || fromKey === toKey) return

  const scope = value(formData, 'scope')
  await supabase.from('workspace_space_links').insert({
    space_id: scope === 'global' ? null : scope,
    from_module_key: fromKey,
    to_module_key: toKey,
    label: value(formData, 'label') || null,
    sort_order: integer(formData, 'sort_order', 100),
  })

  await refreshPaths()
}

export async function removeWorkspaceLink(formData: FormData) {
  const { supabase } = await requireDashboardAccess('/dashboard/spaces')
  const id = value(formData, 'id')
  if (!id) return
  await supabase.from('workspace_space_links').delete().eq('id', id)
  await refreshPaths()
}

export async function addWorkspaceMember(formData: FormData) {
  const { supabase } = await requireDashboardAccess('/dashboard/spaces')
  const spaceId = value(formData, 'space_id')
  const email = value(formData, 'assigned_email').toLowerCase()
  if (!spaceId || !email) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  await supabase.from('workspace_space_members').upsert(
    {
      space_id: spaceId,
      assigned_email: email,
      profile_id: profile?.id ?? null,
      member_label: value(formData, 'member_label') || null,
      sort_order: integer(formData, 'sort_order', 100),
    },
    { onConflict: 'space_id,assigned_email' },
  )

  await refreshPaths()
}

export async function removeWorkspaceMember(formData: FormData) {
  const { supabase } = await requireDashboardAccess('/dashboard/spaces')
  const id = value(formData, 'id')
  if (!id) return
  await supabase.from('workspace_space_members').delete().eq('id', id)
  await refreshPaths()
}

export async function seedStarterWorkspaces() {
  const { supabase, user } = await requireDashboardAccess('/dashboard/spaces')
  const { data: existing } = await supabase.from('workspace_spaces').select('slug')
  const existingSlugs = new Set((existing ?? []).map((row: any) => row.slug))

  const spacesToInsert = STARTER_WORKSPACE_TEMPLATES.filter((template) => !existingSlugs.has(template.slug)).map((template) => ({
    name: template.name,
    slug: template.slug,
    description: template.description,
    color: template.color,
    sort_order: template.sort_order,
    created_by_user_id: user!.id,
  }))

  if (spacesToInsert.length) {
    await supabase.from('workspace_spaces').insert(spacesToInsert)
  }

  const { data: spaces } = await supabase.from('workspace_spaces').select('id, slug')
  const bySlug = new Map((spaces ?? []).map((row: any) => [row.slug, row.id]))

  const moduleRows = STARTER_WORKSPACE_TEMPLATES.flatMap((template) =>
    template.modules.map((moduleKey, index) => ({
      space_id: bySlug.get(template.slug),
      module_key: moduleKey,
      sort_order: (index + 1) * 10,
      is_visible: true,
    })),
  ).filter((row) => row.space_id)

  if (moduleRows.length) {
    await supabase.from('workspace_space_modules').upsert(moduleRows, { onConflict: 'space_id,module_key' })
  }

  const starterLinks = [
    { from_module_key: 'leads', to_module_key: 'deals', label: 'квалификация', sort_order: 10 },
    { from_module_key: 'deals', to_module_key: 'applications', label: 'закрыли продажу', sort_order: 20 },
    { from_module_key: 'applications', to_module_key: 'contracts', label: 'юридический шаг', sort_order: 30 },
    { from_module_key: 'applications', to_module_key: 'create_payment', label: 'выставить счёт', sort_order: 40 },
    { from_module_key: 'finance', to_module_key: 'controlling', label: 'учёт маржи', sort_order: 50 },
    { from_module_key: 'controlling', to_module_key: 'reports', label: 'итоговый контроль', sort_order: 60 },
  ]

  const { data: links } = await supabase.from('workspace_space_links').select('id').is('space_id', null)
  if (!links?.length) {
    await supabase.from('workspace_space_links').insert(starterLinks)
  }

  await refreshPaths()
}
