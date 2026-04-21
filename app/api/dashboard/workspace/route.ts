import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceBuilderData, STARTER_WORKSPACE_TEMPLATES, type WorkspaceModuleKey } from '@/lib/influence-spaces'
import { createDefaultCustomModuleLayout, normalizeCustomModuleLayout } from '@/lib/workspace-custom-layout'
import { getDashboardModule, isAdminRole, type DashboardModuleKey } from '@/lib/roles'

type ApiAction =
  | { action: 'create-space'; name?: string }
  | { action: 'rename-space'; spaceId: string; name: string }
  | { action: 'cycle-space-color'; spaceId: string }
  | { action: 'delete-space'; spaceId: string }
  | { action: 'sync-space-members'; spaceId: string; emails: string[] }
  | { action: 'update-space-layout'; spaceId: string; x?: number; y?: number; width?: number; height?: number }
  | { action: 'move-module'; targetSpaceId: string; placementId?: string | null; moduleKey: WorkspaceModuleKey; x?: number; y?: number }
  | { action: 'remove-module'; placementId: string }
  | { action: 'create-link'; fromSpaceModuleId: string; toSpaceModuleId: string }
  | { action: 'delete-link'; linkId: string }
  | { action: 'graph-add-node'; moduleKey: WorkspaceModuleKey; x?: number; y?: number }
  | { action: 'graph-move-node'; moduleKey: WorkspaceModuleKey; x?: number; y?: number }
  | { action: 'graph-remove-node'; moduleKey: WorkspaceModuleKey }
  | { action: 'graph-create-link'; fromModuleKey: WorkspaceModuleKey; toModuleKey: WorkspaceModuleKey }
  | { action: 'graph-delete-link'; linkId: string }
  | { action: 'seed-starter' }
  | { action: 'seed-graph' }
  | { action: 'create-custom-module'; label: string; slug?: string }
  | { action: 'update-custom-module'; moduleId: string; label?: string; slug?: string; description?: string }
  | { action: 'delete-custom-module'; moduleId: string }
  | { action: 'save-custom-module-layout'; moduleId: string; metadata: unknown }

const SPACE_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#7dd3fc', '#ec4899', '#22c55e', '#f97316', '#6366f1'] as const

function normalizeString(value: unknown) {
  return String(value ?? '').trim()
}

function lowerEmail(value: unknown) {
  return normalizeString(value).toLowerCase()
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function unique<T>(rows: T[]) {
  return Array.from(new Set(rows))
}

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status })
}

function isCustomModuleKey(value: string): value is `custom:${string}` {
  return value.startsWith('custom:')
}

function customModuleIdFromKey(value: string) {
  return isCustomModuleKey(value) ? value.slice('custom:'.length) : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function numberFromUnknown(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return clamp(numeric, min, max)
}

function defaultSpaceLayout(index: number) {
  const column = index % 2
  const row = Math.floor(index / 2)
  return {
    x: 64 + column * 700,
    y: 64 + row * 520,
    width: 620,
    height: 420,
  }
}

function defaultModuleLayout(index: number) {
  const column = index % 2
  const row = Math.floor(index / 2)
  return {
    x: 20 + column * 250,
    y: 20 + row * 108,
  }
}

function defaultGraphNodeLayout(index: number) {
  const column = index % 4
  const row = Math.floor(index / 4)
  return {
    x: 120 + column * 260,
    y: 96 + row * 156,
  }
}

function canvasMetadata(base: unknown, patch: Record<string, unknown>) {
  const metadata = isRecord(base) ? { ...base } : {}
  const canvas = isRecord(metadata.canvas) ? { ...metadata.canvas } : {}
  return {
    ...metadata,
    canvas: {
      ...canvas,
      ...patch,
    },
  }
}

function readCanvasLayout(base: unknown, fallback: { x: number; y: number; width?: number; height?: number }) {
  const source = isRecord(base) && isRecord(base.canvas) ? base.canvas : isRecord(base) ? base : {}
  return {
    x: numberFromUnknown(source.x, fallback.x, 0, 8000),
    y: numberFromUnknown(source.y, fallback.y, 0, 8000),
    width: numberFromUnknown(source.width, fallback.width ?? 620, 420, 1400),
    height: numberFromUnknown(source.height, fallback.height ?? 420, 280, 1200),
  }
}

async function requireWorkspaceAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: jsonError(401, 'unauthorized') as NextResponse }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_active, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_active || !isAdminRole(profile.role)) {
    return { error: jsonError(403, 'forbidden') as NextResponse }
  }

  return {
    supabase,
    admin: createAdminClient(),
    profile,
    user,
  }
}

async function refreshData(extraPaths: string[] = []) {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/spaces')
  revalidatePath('/dashboard/spaces/graph')
  extraPaths.filter(Boolean).forEach((path) => revalidatePath(path))
  const data = await getWorkspaceBuilderData()
  return NextResponse.json({ ok: true, data })
}

async function getNextSortOrder(
  admin: ReturnType<typeof createAdminClient>,
  table:
    | 'workspace_spaces'
    | 'workspace_space_modules'
    | 'workspace_visual_links'
    | 'workspace_module_graph_nodes'
    | 'workspace_module_graph_links',
  column = 'sort_order',
) {
  const { data } = await admin.from(table).select(column).order(column, { ascending: false }).limit(1).maybeSingle()
  const current = Number((data as Record<string, unknown> | null)?.[column] ?? 0)
  return (Number.isFinite(current) ? current : 0) + 10
}

async function getSpaceCount(admin: ReturnType<typeof createAdminClient>) {
  const { count } = await admin.from('workspace_spaces').select('id', { count: 'exact', head: true })
  return Number(count ?? 0)
}

async function getSpaceMetadata(admin: ReturnType<typeof createAdminClient>, spaceId: string) {
  const { data } = await admin.from('workspace_spaces').select('metadata').eq('id', spaceId).maybeSingle()
  return (data as { metadata?: unknown } | null)?.metadata ?? null
}

async function getModuleMetadata(admin: ReturnType<typeof createAdminClient>, placementId: string) {
  const { data } = await admin.from('workspace_space_modules').select('metadata').eq('id', placementId).maybeSingle()
  return (data as { metadata?: unknown } | null)?.metadata ?? null
}

async function getGraphNodeMetadata(admin: ReturnType<typeof createAdminClient>, moduleKey: WorkspaceModuleKey) {
  const { data } = await admin.from('workspace_module_graph_nodes').select('metadata').eq('module_key', moduleKey).maybeSingle()
  return (data as { metadata?: unknown } | null)?.metadata ?? null
}

async function syncSpaceMembers(admin: ReturnType<typeof createAdminClient>, spaceId: string, emails: string[]) {
  const normalized = unique(emails.map(lowerEmail).filter(Boolean))

  const { data: existingRows } = await admin
    .from('workspace_space_members')
    .select('id, assigned_email')
    .eq('space_id', spaceId)

  const existing = (existingRows ?? []) as { id: string; assigned_email: string }[]
  const existingByEmail = new Map(existing.map((row) => [lowerEmail(row.assigned_email), row]))

  const toDelete = existing.filter((row) => !normalized.includes(lowerEmail(row.assigned_email))).map((row) => row.id)
  if (toDelete.length) {
    await admin.from('workspace_space_members').delete().in('id', toDelete)
  }

  if (!normalized.length) return

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email')
    .in('email', normalized)

  const profileByEmail = new Map(((profiles ?? []) as { id: string; email: string | null }[]).map((row) => [lowerEmail(row.email), row.id]))

  const toInsert = normalized
    .filter((email) => !existingByEmail.has(email))
    .map((email, index) => ({
      space_id: spaceId,
      assigned_email: email,
      profile_id: profileByEmail.get(email) ?? null,
      sort_order: (index + 1) * 10,
    }))

  if (toInsert.length) {
    await admin.from('workspace_space_members').insert(toInsert)
  }
}

async function ensureModuleExists(admin: ReturnType<typeof createAdminClient>, key: string) {
  if (getDashboardModule(key as DashboardModuleKey)) return true
  const customId = customModuleIdFromKey(key)
  if (!customId) return false
  const { data } = await admin.from('workspace_custom_modules').select('id').eq('id', customId).eq('is_active', true).maybeSingle()
  return Boolean(data)
}

async function uniqueCustomSlug(admin: ReturnType<typeof createAdminClient>, raw: string, excludeId?: string) {
  const base = slugify(raw) || 'section'
  let slug = base
  let counter = 2

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = admin.from('workspace_custom_modules').select('id').eq('slug', slug)
    if (excludeId) query = query.neq('id', excludeId)
    const { data } = await query.maybeSingle()
    if (!data) return slug
    slug = `${base}-${counter++}`
  }
}

async function seedStarter(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: ownerProfile } = await admin.from('profiles').select('id, email').eq('id', userId).maybeSingle()
  const ownerEmail = lowerEmail((ownerProfile as { email?: string | null } | null)?.email)

  const { data: existingSpaces } = await admin.from('workspace_spaces').select('id, slug')
  const bySlug = new Map(((existingSpaces ?? []) as { id: string; slug: string }[]).map((row) => [row.slug, row.id]))

  const spacesToInsert = STARTER_WORKSPACE_TEMPLATES.filter((template) => !bySlug.has(template.slug)).map((template, index) => ({
    name: template.name,
    slug: template.slug,
    description: template.description,
    color: template.color,
    sort_order: template.sort_order,
    metadata: canvasMetadata(null, defaultSpaceLayout(index)),
    created_by_user_id: userId,
  }))

  if (spacesToInsert.length) {
    await admin.from('workspace_spaces').insert(spacesToInsert)
  }

  const { data: allSpaces } = await admin.from('workspace_spaces').select('id, slug')
  const idBySlug = new Map(((allSpaces ?? []) as { id: string; slug: string }[]).map((row) => [row.slug, row.id]))

  for (const [spaceIndex, template] of STARTER_WORKSPACE_TEMPLATES.entries()) {
    const spaceId = idBySlug.get(template.slug)
    if (!spaceId) continue

    if (ownerEmail) {
      const { data: existingMember } = await admin
        .from('workspace_space_members')
        .select('id')
        .eq('space_id', spaceId)
        .eq('assigned_email', ownerEmail)
        .maybeSingle()

      if (!existingMember) {
        await admin.from('workspace_space_members').insert({
          space_id: spaceId,
          assigned_email: ownerEmail,
          profile_id: userId,
          member_label: 'Owner',
          sort_order: 10,
        })
      }
    }

    const { data: existingModules } = await admin.from('workspace_space_modules').select('module_key').eq('space_id', spaceId)
    const existingKeys = new Set(((existingModules ?? []) as { module_key: string }[]).map((row) => row.module_key))
    const inserts = template.modules
      .filter((moduleKey) => !existingKeys.has(moduleKey))
      .map((moduleKey, index) => ({
        space_id: spaceId,
        module_key: moduleKey,
        sort_order: (index + 1) * 10,
        is_visible: true,
        metadata: canvasMetadata(null, defaultModuleLayout(index)),
      }))

    if (inserts.length) {
      await admin.from('workspace_space_modules').insert(inserts)
    }

    const currentMetadata = await getSpaceMetadata(admin, spaceId)
    const currentLayout = readCanvasLayout(currentMetadata, defaultSpaceLayout(spaceIndex))
    const maybeNormalized = canvasMetadata(currentMetadata, currentLayout)
    await admin.from('workspace_spaces').update({ metadata: maybeNormalized }).eq('id', spaceId)
  }

  const { data: allModules } = await admin.from('workspace_space_modules').select('id, space_id, module_key')
  const moduleRows = (allModules ?? []) as { id: string; space_id: string; module_key: string }[]

  const findModuleId = (slug: string, key: DashboardModuleKey) => {
    const spaceId = idBySlug.get(slug)
    return moduleRows.find((row) => row.space_id === spaceId && row.module_key === key)?.id ?? null
  }

  const standardLinks: Array<[string | null, string | null]> = [
    [findModuleId('sales', 'leads'), findModuleId('sales', 'deals')],
    [findModuleId('sales', 'deals'), findModuleId('backoffice', 'applications')],
    [findModuleId('backoffice', 'applications'), findModuleId('backoffice', 'contracts')],
    [findModuleId('backoffice', 'applications'), findModuleId('backoffice', 'create_payment')],
    [findModuleId('ops', 'finance'), findModuleId('administration', 'controlling')],
    [findModuleId('administration', 'controlling'), findModuleId('administration', 'reports')],
  ].filter((pair): pair is [string, string] => Boolean(pair[0] && pair[1]))

  for (const [fromId, toId] of standardLinks) {
    const { data: exists } = await admin
      .from('workspace_visual_links')
      .select('id')
      .eq('from_space_module_id', fromId)
      .eq('to_space_module_id', toId)
      .maybeSingle()

    if (!exists) {
      const sortOrder = await getNextSortOrder(admin, 'workspace_visual_links')
      await admin.from('workspace_visual_links').insert({
        from_space_module_id: fromId,
        to_space_module_id: toId,
        sort_order: sortOrder,
      })
    }
  }
}

async function seedGraph(admin: ReturnType<typeof createAdminClient>) {
  const starterKeys = Array.from(
    new Set(
      STARTER_WORKSPACE_TEMPLATES.flatMap((template) => template.modules).concat([
        'contracts',
        'create_payment',
        'finance',
        'communications',
        'settings',
        'my_leads',
      ]),
    ),
  ) as WorkspaceModuleKey[]

  const { data: existingNodes } = await admin.from('workspace_module_graph_nodes').select('module_key')
  const existingNodeKeys = new Set(((existingNodes ?? []) as { module_key: string }[]).map((row) => row.module_key))

  const inserts = starterKeys
    .filter((key) => !existingNodeKeys.has(key))
    .map((moduleKey, index) => ({
      module_key: moduleKey,
      sort_order: (index + 1) * 10,
      metadata: canvasMetadata(null, defaultGraphNodeLayout(index)),
    }))

  if (inserts.length) {
    await admin.from('workspace_module_graph_nodes').insert(inserts)
  }

  const starterLinks: Array<[WorkspaceModuleKey, WorkspaceModuleKey]> = [
    ['dashboard', 'leads'],
    ['leads', 'my_leads'],
    ['my_leads', 'deals'],
    ['deals', 'applications'],
    ['applications', 'contracts'],
    ['applications', 'create_payment'],
    ['create_payment', 'finance'],
    ['finance', 'controlling'],
    ['controlling', 'reports'],
  ]

  for (const [fromModuleKey, toModuleKey] of starterLinks) {
    const { data: exists } = await admin
      .from('workspace_module_graph_links')
      .select('id')
      .eq('from_module_key', fromModuleKey)
      .eq('to_module_key', toModuleKey)
      .maybeSingle()

    if (!exists) {
      const sortOrder = await getNextSortOrder(admin, 'workspace_module_graph_links')
      await admin.from('workspace_module_graph_links').insert({
        from_module_key: fromModuleKey,
        to_module_key: toModuleKey,
        sort_order: sortOrder,
      })
    }
  }
}

export async function POST(request: Request) {
  const context = await requireWorkspaceAdmin()
  if ('error' in context) return context.error

  const payload = (await request.json()) as ApiAction
  const { admin, user } = context
  const extraRevalidatePaths = new Set<string>()

  switch (payload.action) {
    case 'create-space': {
      const name = normalizeString(payload.name) || 'Новая зона'
      const slugBase = slugify(name) || 'space'
      const { data: existing } = await admin.from('workspace_spaces').select('slug').ilike('slug', `${slugBase}%`)
      const suffix = (existing ?? []).length ? `-${(existing ?? []).length + 1}` : ''
      const sortOrder = await getNextSortOrder(admin, 'workspace_spaces')
      const color = SPACE_COLORS[Math.floor(sortOrder / 10) % SPACE_COLORS.length] ?? '#7dd3fc'
      const index = await getSpaceCount(admin)
      await admin.from('workspace_spaces').insert({
        name,
        slug: `${slugBase}${suffix}`,
        color,
        sort_order: sortOrder,
        metadata: canvasMetadata(null, defaultSpaceLayout(index)),
        created_by_user_id: user.id,
      })
      break
    }
    case 'rename-space': {
      const name = normalizeString(payload.name)
      if (!payload.spaceId || !name) return jsonError(400, 'invalid_space_name')
      await admin.from('workspace_spaces').update({ name }).eq('id', payload.spaceId)
      break
    }
    case 'cycle-space-color': {
      if (!payload.spaceId) return jsonError(400, 'invalid_space')
      const { data: space } = await admin.from('workspace_spaces').select('color').eq('id', payload.spaceId).maybeSingle()
      const currentColor = normalizeString((space as { color?: string } | null)?.color || '') || SPACE_COLORS[0]
      const currentIndex = Math.max(0, SPACE_COLORS.indexOf(currentColor as (typeof SPACE_COLORS)[number]))
      const nextColor = SPACE_COLORS[(currentIndex + 1) % SPACE_COLORS.length]
      await admin.from('workspace_spaces').update({ color: nextColor }).eq('id', payload.spaceId)
      break
    }
    case 'delete-space': {
      if (!payload.spaceId) return jsonError(400, 'invalid_space')
      await admin.from('workspace_spaces').delete().eq('id', payload.spaceId)
      break
    }
    case 'sync-space-members': {
      if (!payload.spaceId) return jsonError(400, 'invalid_space')
      await syncSpaceMembers(admin, payload.spaceId, Array.isArray(payload.emails) ? payload.emails : [])
      break
    }
    case 'update-space-layout': {
      if (!payload.spaceId) return jsonError(400, 'invalid_space')
      const currentMetadata = await getSpaceMetadata(admin, payload.spaceId)
      const currentLayout = readCanvasLayout(currentMetadata, defaultSpaceLayout(0))
      const nextLayout = {
        x: numberFromUnknown(payload.x, currentLayout.x, 0, 8000),
        y: numberFromUnknown(payload.y, currentLayout.y, 0, 8000),
        width: numberFromUnknown(payload.width, currentLayout.width, 420, 1400),
        height: numberFromUnknown(payload.height, currentLayout.height, 280, 1200),
      }
      await admin.from('workspace_spaces').update({ metadata: canvasMetadata(currentMetadata, nextLayout) }).eq('id', payload.spaceId)
      break
    }
    case 'move-module': {
      if (!payload.targetSpaceId || !payload.moduleKey) return jsonError(400, 'invalid_module_move')
      if (!(await ensureModuleExists(admin, payload.moduleKey))) return jsonError(400, 'unknown_module_key')

      const targetPoint = {
        x: numberFromUnknown(payload.x, 20, 0, 6000),
        y: numberFromUnknown(payload.y, 20, 0, 6000),
      }

      const { data: existingTarget } = await admin
        .from('workspace_space_modules')
        .select('id, metadata')
        .eq('space_id', payload.targetSpaceId)
        .eq('module_key', payload.moduleKey)
        .maybeSingle()

      if (payload.placementId) {
        if (existingTarget && existingTarget.id !== payload.placementId) {
          return jsonError(409, 'module_already_in_space')
        }

        const currentMetadata = await getModuleMetadata(admin, payload.placementId)
        const sortOrder = await getNextSortOrder(admin, 'workspace_space_modules')
        await admin
          .from('workspace_space_modules')
          .update({
            space_id: payload.targetSpaceId,
            sort_order: sortOrder,
            metadata: canvasMetadata(currentMetadata, targetPoint),
          })
          .eq('id', payload.placementId)
      } else if (existingTarget) {
        await admin
          .from('workspace_space_modules')
          .update({ metadata: canvasMetadata(existingTarget.metadata, targetPoint) })
          .eq('id', existingTarget.id)
      } else {
        const sortOrder = await getNextSortOrder(admin, 'workspace_space_modules')
        await admin.from('workspace_space_modules').insert({
          space_id: payload.targetSpaceId,
          module_key: payload.moduleKey,
          sort_order: sortOrder,
          is_visible: true,
          metadata: canvasMetadata(null, targetPoint),
        })
      }
      break
    }
    case 'remove-module': {
      if (!payload.placementId) return jsonError(400, 'invalid_module')
      await admin.from('workspace_space_modules').delete().eq('id', payload.placementId)
      break
    }
    case 'create-link': {
      if (!payload.fromSpaceModuleId || !payload.toSpaceModuleId || payload.fromSpaceModuleId === payload.toSpaceModuleId) {
        return jsonError(400, 'invalid_link')
      }
      const { data: exists } = await admin
        .from('workspace_visual_links')
        .select('id')
        .eq('from_space_module_id', payload.fromSpaceModuleId)
        .eq('to_space_module_id', payload.toSpaceModuleId)
        .maybeSingle()

      if (!exists) {
        const sortOrder = await getNextSortOrder(admin, 'workspace_visual_links')
        await admin.from('workspace_visual_links').insert({
          from_space_module_id: payload.fromSpaceModuleId,
          to_space_module_id: payload.toSpaceModuleId,
          sort_order: sortOrder,
        })
      }
      break
    }
    case 'delete-link': {
      if (!payload.linkId) return jsonError(400, 'invalid_link')
      await admin.from('workspace_visual_links').delete().eq('id', payload.linkId)
      break
    }
    case 'graph-add-node': {
      if (!payload.moduleKey) return jsonError(400, 'invalid_graph_node')
      if (!(await ensureModuleExists(admin, payload.moduleKey))) return jsonError(400, 'unknown_module_key')
      const point = {
        x: numberFromUnknown(payload.x, 120, 0, 8000),
        y: numberFromUnknown(payload.y, 96, 0, 8000),
      }
      const { data: existingNode } = await admin
        .from('workspace_module_graph_nodes')
        .select('id, metadata')
        .eq('module_key', payload.moduleKey)
        .maybeSingle()

      if (existingNode) {
        await admin
          .from('workspace_module_graph_nodes')
          .update({ metadata: canvasMetadata(existingNode.metadata, point) })
          .eq('id', existingNode.id)
      } else {
        const sortOrder = await getNextSortOrder(admin, 'workspace_module_graph_nodes')
        await admin.from('workspace_module_graph_nodes').insert({
          module_key: payload.moduleKey,
          sort_order: sortOrder,
          metadata: canvasMetadata(null, point),
        })
      }
      break
    }
    case 'graph-move-node': {
      if (!payload.moduleKey) return jsonError(400, 'invalid_graph_node')
      const currentMetadata = await getGraphNodeMetadata(admin, payload.moduleKey)
      const fallback = defaultGraphNodeLayout(0)
      const point = {
        x: numberFromUnknown(payload.x, fallback.x, 0, 8000),
        y: numberFromUnknown(payload.y, fallback.y, 0, 8000),
      }
      await admin
        .from('workspace_module_graph_nodes')
        .update({ metadata: canvasMetadata(currentMetadata, point) })
        .eq('module_key', payload.moduleKey)
      break
    }
    case 'graph-remove-node': {
      if (!payload.moduleKey) return jsonError(400, 'invalid_graph_node')
      await admin.from('workspace_module_graph_nodes').delete().eq('module_key', payload.moduleKey)
      await Promise.all([
        admin.from('workspace_module_graph_links').delete().eq('from_module_key', payload.moduleKey),
        admin.from('workspace_module_graph_links').delete().eq('to_module_key', payload.moduleKey),
      ])
      break
    }
    case 'graph-create-link': {
      if (!payload.fromModuleKey || !payload.toModuleKey || payload.fromModuleKey === payload.toModuleKey) {
        return jsonError(400, 'invalid_graph_link')
      }
      if (!(await ensureModuleExists(admin, payload.fromModuleKey)) || !(await ensureModuleExists(admin, payload.toModuleKey))) {
        return jsonError(400, 'unknown_module_key')
      }
      const { data: exists } = await admin
        .from('workspace_module_graph_links')
        .select('id')
        .eq('from_module_key', payload.fromModuleKey)
        .eq('to_module_key', payload.toModuleKey)
        .maybeSingle()

      if (!exists) {
        const sortOrder = await getNextSortOrder(admin, 'workspace_module_graph_links')
        await admin.from('workspace_module_graph_links').insert({
          from_module_key: payload.fromModuleKey,
          to_module_key: payload.toModuleKey,
          sort_order: sortOrder,
        })
      }
      break
    }
    case 'graph-delete-link': {
      if (!payload.linkId) return jsonError(400, 'invalid_graph_link')
      await admin.from('workspace_module_graph_links').delete().eq('id', payload.linkId)
      break
    }
    case 'seed-starter': {
      await seedStarter(admin, user.id)
      break
    }
    case 'seed-graph': {
      await seedGraph(admin)
      break
    }
    case 'create-custom-module': {
      const label = normalizeString(payload.label)
      if (!label) return jsonError(400, 'invalid_custom_module_label')
      const slug = await uniqueCustomSlug(admin, normalizeString(payload.slug) || label)
      const route = `/dashboard/custom/${slug}`
      await admin.from('workspace_custom_modules').insert({
        label,
        slug,
        metadata: createDefaultCustomModuleLayout({ title: label, route }),
        created_by_user_id: user.id,
      })
      extraRevalidatePaths.add(route)
      break
    }
    case 'update-custom-module': {
      if (!payload.moduleId) return jsonError(400, 'invalid_custom_module')
      const patch: Record<string, unknown> = {}
      const label = normalizeString(payload.label)
      if (label) patch.label = label
      const slugRaw = normalizeString(payload.slug)
      if (slugRaw) patch.slug = await uniqueCustomSlug(admin, slugRaw, payload.moduleId)
      if (typeof payload.description === 'string') patch.description = normalizeString(payload.description) || null
      await admin.from('workspace_custom_modules').update(patch).eq('id', payload.moduleId)
      break
    }
    case 'delete-custom-module': {
      if (!payload.moduleId) return jsonError(400, 'invalid_custom_module')
      const moduleKey = `custom:${payload.moduleId}`
      const { data: placements } = await admin.from('workspace_space_modules').select('id').eq('module_key', moduleKey)
      const placementIds = ((placements ?? []) as { id: string }[]).map((row) => row.id)
      if (placementIds.length) {
        await admin.from('workspace_space_modules').delete().in('id', placementIds)
      }
      await Promise.all([
        admin.from('workspace_module_graph_nodes').delete().eq('module_key', moduleKey),
        admin.from('workspace_module_graph_links').delete().eq('from_module_key', moduleKey),
        admin.from('workspace_module_graph_links').delete().eq('to_module_key', moduleKey),
      ])
      await admin.from('workspace_custom_modules').delete().eq('id', payload.moduleId)
      break
    }
    case 'save-custom-module-layout': {
      if (!payload.moduleId) return jsonError(400, 'invalid_custom_module')
      const { data: moduleRow } = await admin
        .from('workspace_custom_modules')
        .select('id, label, slug, description')
        .eq('id', payload.moduleId)
        .maybeSingle()

      const currentModule = moduleRow as { id: string; label: string; slug: string; description: string | null } | null
      if (!currentModule) return jsonError(404, 'custom_module_not_found')

      const route = `/dashboard/custom/${currentModule.slug}`
      const metadata = normalizeCustomModuleLayout({
        title: currentModule.label,
        description: currentModule.description,
        route,
        metadata: payload.metadata,
      })

      await admin.from('workspace_custom_modules').update({ metadata }).eq('id', payload.moduleId)
      extraRevalidatePaths.add(route)
      break
    }
    default:
      return jsonError(400, 'unknown_action')
  }

  return refreshData(Array.from(extraRevalidatePaths))
}
