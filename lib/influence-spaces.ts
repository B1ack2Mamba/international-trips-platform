import { createClient } from '@/lib/supabase/server'
import { normalizeCustomModuleLayout, type CustomModuleLayout } from '@/lib/workspace-custom-layout'
import {
  getDashboardModule,
  getDashboardModules,
  getDashboardNavGroups,
  isActiveDashboardModuleKey,
  isExecutiveRole,
  isRoleAllowedForModule,
  isStaffRole,
  type DashboardModuleDefinition,
  type DashboardModuleKey,
} from '@/lib/roles'

export type WorkspaceModuleKey = DashboardModuleKey | `custom:${string}`

export type WorkspaceModuleDefinition = {
  key: WorkspaceModuleKey
  href: string
  label: string
  description: string
  routePath: string
  groupTitle: string
  kind: 'builtin' | 'custom'
  editable: boolean
  source_id: string | null
}

export type WorkspaceNavItem = Pick<WorkspaceModuleDefinition, 'key' | 'href' | 'label' | 'description'>
export type WorkspaceNavGroup = {
  title: string
  items: WorkspaceNavItem[]
}

export type WorkspaceColor = string

export type WorkspaceSpaceLayout = {
  x: number
  y: number
  width: number
  height: number
}

export type WorkspaceModuleLayout = {
  x: number
  y: number
}

export type WorkspaceBoardMetrics = {
  width: number
  height: number
}

type MinimalProfile = {
  id: string
  email: string | null
  role: string | null
  full_name?: string | null
}

type WorkspaceSpaceRow = {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  sort_order: number | null
  is_active: boolean | null
  metadata?: unknown
}

type WorkspaceModuleRow = {
  id: string
  space_id: string
  module_key: string
  sort_order: number | null
  is_visible: boolean | null
  notes: string | null
  metadata?: unknown
}

type WorkspaceVisualLinkRow = {
  id: string
  from_space_module_id: string
  to_space_module_id: string
  sort_order: number | null
}

type WorkspaceGraphNodeRow = {
  id: string
  module_key: string
  sort_order: number | null
  metadata?: unknown
}

type WorkspaceGraphLinkRow = {
  id: string
  from_module_key: string
  to_module_key: string
  sort_order: number | null
}

type WorkspaceMemberRow = {
  id: string
  space_id: string
  assigned_email: string
  profile_id: string | null
  member_label: string | null
  sort_order: number | null
}

type ProfileLookupRow = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  is_active: boolean | null
}

type WorkspaceCustomModuleRow = {
  id: string
  label: string
  slug: string
  description: string | null
  color: string | null
  metadata?: unknown
  is_active: boolean | null
}

export type WorkspaceModulePlacement = {
  id: string
  key: WorkspaceModuleKey
  sort_order: number
  is_visible: boolean
  notes: string | null
  layout: WorkspaceModuleLayout
  module: WorkspaceModuleDefinition
}

export type WorkspaceLinkRef = {
  space_id: string | null
  module_key: WorkspaceModuleKey
  placement_key: string
}

export type WorkspaceLink = {
  id: string
  space_id: string | null
  from_space_id: string | null
  to_space_id: string | null
  label: string | null
  sort_order: number
  from: WorkspaceModuleDefinition
  to: WorkspaceModuleDefinition
  from_ref: WorkspaceLinkRef
  to_ref: WorkspaceLinkRef
  is_cross_space: boolean
}

export type WorkspaceVisualLink = {
  id: string
  from_space_module_id: string
  to_space_module_id: string
  sort_order: number
  from_space_id: string | null
  to_space_id: string | null
  from_module: WorkspaceModuleDefinition
  to_module: WorkspaceModuleDefinition
}

export type WorkspaceGraphNode = {
  id: string
  key: WorkspaceModuleKey
  sort_order: number
  layout: WorkspaceModuleLayout
  module: WorkspaceModuleDefinition
}

export type WorkspaceGraphLink = {
  id: string
  from_module_key: WorkspaceModuleKey
  to_module_key: WorkspaceModuleKey
  sort_order: number
  from_module: WorkspaceModuleDefinition
  to_module: WorkspaceModuleDefinition
}

export type WorkspaceMember = {
  id: string
  assigned_email: string
  profile_id: string | null
  member_label: string | null
  sort_order: number
  profile: ProfileLookupRow | null
}

export type WorkspaceSpace = {
  id: string
  name: string
  slug: string
  description: string | null
  color: WorkspaceColor
  sort_order: number
  is_active: boolean
  layout: WorkspaceSpaceLayout
  modules: WorkspaceModulePlacement[]
  links: WorkspaceLink[]
  members: WorkspaceMember[]
}

export type WorkspaceBuilderData = {
  spaces: WorkspaceSpace[]
  globalLinks: WorkspaceLink[]
  visualLinks: WorkspaceVisualLink[]
  graphNodes: WorkspaceGraphNode[]
  graphLinks: WorkspaceGraphLink[]
  catalog: WorkspaceModuleDefinition[]
  catalogGroups: { title: string; modules: WorkspaceModuleDefinition[] }[]
  profiles: ProfileLookupRow[]
  customScreens: WorkspaceCustomModuleScreen[]
  board: WorkspaceBoardMetrics
  graphBoard: WorkspaceBoardMetrics
}

export type WorkspaceCustomModuleScreen = WorkspaceModuleDefinition & {
  color: string
  metadata: CustomModuleLayout
}

export const STARTER_WORKSPACE_TEMPLATES: readonly {
  name: string
  slug: string
  color: string
  sort_order: number
  description: string
  modules: readonly DashboardModuleKey[]
}[] = [
  {
    name: 'Администрация',
    slug: 'administration',
    color: '#8b5cf6',
    sort_order: 10,
    description: 'Общий обзор, отчёты, контроллинг, настройки и доступ к конструктору.',
    modules: ['dashboard', 'reports', 'controlling', 'finance', 'settings', 'spaces'],
  },
  {
    name: 'Продажи',
    slug: 'sales',
    color: '#10b981',
    sort_order: 20,
    description: 'Входящий поток, сделки, аккаунты, скрипты и продукт для продажи.',
    modules: ['dashboard', 'leads', 'my_leads', 'deals', 'accounts', 'scripts', 'programs', 'departures'],
  },
  {
    name: 'Оформление',
    slug: 'backoffice',
    color: '#f59e0b',
    sort_order: 30,
    description: 'Участники, договоры, платежи, коммуникации и сопровождение семьи.',
    modules: ['dashboard', 'applications', 'contracts', 'create_payment', 'communications', 'accounts', 'departures'],
  },
  {
    name: 'Выезды и операционка',
    slug: 'ops',
    color: '#7dd3fc',
    sort_order: 40,
    description: 'Выезды, операционка, программы, финансы поездки и отчётность.',
    modules: ['dashboard', 'departures', 'ops', 'programs', 'finance', 'reports'],
  },
] as const

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeColor(value: string | null | undefined) {
  const color = String(value ?? '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(color) || /^#[0-9a-fA-F]{3}$/.test(color)) return color
  return '#7dd3fc'
}

function lowerEmail(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

function sortByOrder<T extends { sort_order?: number | null }>(rows: T[]) {
  return [...rows].sort((a, b) => Number(a.sort_order ?? 1000) - Number(b.sort_order ?? 1000))
}

function unique<T>(rows: T[]) {
  return Array.from(new Set(rows))
}

function notNull<T>(value: T | null): value is T {
  return value !== null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function numberFromUnknown(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return clamp(numeric, min, max)
}

function readCanvasSource(metadata: unknown) {
  if (!isRecord(metadata)) return null
  if (isRecord(metadata.canvas)) return metadata.canvas
  return metadata
}

function defaultSpaceLayout(index: number): WorkspaceSpaceLayout {
  const column = index % 2
  const row = Math.floor(index / 2)
  return {
    x: 64 + column * 700,
    y: 64 + row * 520,
    width: 620,
    height: 420,
  }
}

function normalizeSpaceLayout(metadata: unknown, index: number): WorkspaceSpaceLayout {
  const fallback = defaultSpaceLayout(index)
  const canvas = readCanvasSource(metadata)
  return {
    x: numberFromUnknown(canvas?.x, fallback.x, 0, 8000),
    y: numberFromUnknown(canvas?.y, fallback.y, 0, 8000),
    width: numberFromUnknown(canvas?.width, fallback.width, 420, 1400),
    height: numberFromUnknown(canvas?.height, fallback.height, 280, 1200),
  }
}

function defaultModuleLayout(index: number): WorkspaceModuleLayout {
  const column = index % 2
  const row = Math.floor(index / 2)
  return {
    x: 20 + column * 250,
    y: 20 + row * 108,
  }
}

function normalizeModuleLayout(metadata: unknown, index: number): WorkspaceModuleLayout {
  const fallback = defaultModuleLayout(index)
  const canvas = readCanvasSource(metadata)
  return {
    x: numberFromUnknown(canvas?.x, fallback.x, 0, 6000),
    y: numberFromUnknown(canvas?.y, fallback.y, 0, 6000),
  }
}

function defaultGraphNodeLayout(index: number): WorkspaceModuleLayout {
  const column = index % 4
  const row = Math.floor(index / 4)
  return {
    x: 120 + column * 260,
    y: 96 + row * 156,
  }
}

function normalizeGraphNodeLayout(metadata: unknown, index: number): WorkspaceModuleLayout {
  const fallback = defaultGraphNodeLayout(index)
  const canvas = readCanvasSource(metadata)
  return {
    x: numberFromUnknown(canvas?.x, fallback.x, 0, 8000),
    y: numberFromUnknown(canvas?.y, fallback.y, 0, 8000),
  }
}

function computeBoardSize(spaces: WorkspaceSpace[]): WorkspaceBoardMetrics {
  const width = Math.max(1800, ...spaces.map((space) => space.layout.x + space.layout.width + 120))
  const height = Math.max(1100, ...spaces.map((space) => space.layout.y + space.layout.height + 120))
  return { width, height }
}

function computeGraphBoardSize(nodes: WorkspaceGraphNode[]): WorkspaceBoardMetrics {
  const width = Math.max(1800, ...nodes.map((node) => node.layout.x + 280))
  const height = Math.max(1100, ...nodes.map((node) => node.layout.y + 220))
  return { width, height }
}

function placementKey(spaceId: string | null, moduleKey: WorkspaceModuleKey) {
  return `${spaceId ?? 'global'}:${moduleKey}`
}

function makeBuiltinModuleDefinition(module: DashboardModuleDefinition): WorkspaceModuleDefinition {
  return {
    key: module.key,
    href: module.href,
    label: module.label,
    description: module.description,
    routePath: module.routePath,
    groupTitle: module.groupTitle,
    kind: 'builtin',
    editable: false,
    source_id: null,
  }
}

function customKey(id: string): WorkspaceModuleKey {
  return `custom:${id}`
}

function extractCustomId(key: WorkspaceModuleKey | string) {
  if (!key.startsWith('custom:')) return null
  return key.slice('custom:'.length) || null
}

export function isCustomWorkspaceModuleKey(key: WorkspaceModuleKey | string): key is `custom:${string}` {
  return key.startsWith('custom:')
}

function makeCustomModuleDefinition(row: WorkspaceCustomModuleRow): WorkspaceModuleDefinition {
  return {
    key: customKey(row.id),
    href: `/dashboard/custom/${row.slug}`,
    label: row.label,
    description: row.description?.trim() || 'Пользовательский раздел из конструктора.',
    routePath: `/dashboard/custom/${row.slug}`,
    groupTitle: 'Свои разделы',
    kind: 'custom',
    editable: true,
    source_id: row.id,
  }
}

function catalogGroups(modules: WorkspaceModuleDefinition[]) {
  const titles = unique(modules.map((item) => item.groupTitle))
  return titles.map((title) => ({
    title,
    modules: modules.filter((item) => item.groupTitle === title),
  }))
}

function isWorkspaceModuleAllowed(role: string | null | undefined, module: WorkspaceModuleDefinition) {
  if (!isStaffRole(role)) return false
  if (module.kind === 'custom') return true
  return isActiveDashboardModuleKey(module.key as DashboardModuleKey)
}

function pathMatchesModule(path: string, module: WorkspaceModuleDefinition) {
  return path === module.routePath || path.startsWith(`${module.routePath}/`)
}

async function fetchWorkspaceTopology(supabaseArg?: Awaited<ReturnType<typeof createClient>>) {
  const supabase = supabaseArg ?? (await createClient())
  const [spacesRes, modulesRes, visualLinksRes, graphNodesRes, graphLinksRes, membersRes, profilesRes, customModulesRes] = await Promise.all([
    supabase.from('workspace_spaces').select('id, name, slug, description, color, sort_order, is_active, metadata').order('sort_order', { ascending: true }),
    supabase.from('workspace_space_modules').select('id, space_id, module_key, sort_order, is_visible, notes, metadata').order('sort_order', { ascending: true }),
    supabase.from('workspace_visual_links').select('id, from_space_module_id, to_space_module_id, sort_order').order('sort_order', { ascending: true }),
    supabase.from('workspace_module_graph_nodes').select('id, module_key, sort_order, metadata').order('sort_order', { ascending: true }),
    supabase.from('workspace_module_graph_links').select('id, from_module_key, to_module_key, sort_order').order('sort_order', { ascending: true }),
    supabase.from('workspace_space_members').select('id, space_id, assigned_email, profile_id, member_label, sort_order').order('sort_order', { ascending: true }),
    supabase.from('profiles').select('id, email, full_name, role, is_active').order('created_at', { ascending: false }).limit(200),
    supabase.from('workspace_custom_modules').select('id, label, slug, description, color, metadata, is_active').eq('is_active', true).order('created_at', { ascending: true }),
  ])

  const spaceRows = asRows<WorkspaceSpaceRow>(spacesRes.data)
  const moduleRows = asRows<WorkspaceModuleRow>(modulesRes.data)
  const visualLinkRows = asRows<WorkspaceVisualLinkRow>(visualLinksRes.data)
  const graphNodeRows = asRows<WorkspaceGraphNodeRow>(graphNodesRes.data)
  const graphLinkRows = asRows<WorkspaceGraphLinkRow>(graphLinksRes.data)
  const memberRows = asRows<WorkspaceMemberRow>(membersRes.data)
  const profileRows = asRows<ProfileLookupRow>(profilesRes.data)
  const customRows = asRows<WorkspaceCustomModuleRow>(customModulesRes.data)

  const builtins = getDashboardModules().map(makeBuiltinModuleDefinition)
  const customs = customRows.map(makeCustomModuleDefinition)
  const customScreens = customRows.map((row) => {
    const module = makeCustomModuleDefinition(row)
    return {
      ...module,
      color: normalizeColor(row.color),
      metadata: normalizeCustomModuleLayout({
        title: row.label,
        description: row.description,
        route: module.href,
        metadata: row.metadata,
      }),
    } satisfies WorkspaceCustomModuleScreen
  })

  const catalog = [...builtins, ...customs]
  const catalogByKey = new Map(catalog.map((module) => [module.key, module]))

  const profilesById = new Map(profileRows.map((profile) => [profile.id, profile]))
  const profilesByEmail = new Map(profileRows.map((profile) => [lowerEmail(profile.email), profile]))
  const activeSpaces = sortByOrder(spaceRows).filter((space) => space.is_active !== false)

  const builtSpaces: WorkspaceSpace[] = activeSpaces.map((space, spaceIndex) => {
    const rawPlacements = sortByOrder(moduleRows.filter((row) => row.space_id === space.id))
    const placements = rawPlacements
      .map((row, placementIndex) => {
        const module = catalogByKey.get(row.module_key as WorkspaceModuleKey)
        if (!module) return null
        return {
          id: row.id,
          key: row.module_key as WorkspaceModuleKey,
          sort_order: Number(row.sort_order ?? 100),
          is_visible: row.is_visible !== false,
          notes: row.notes,
          layout: normalizeModuleLayout(row.metadata, placementIndex),
          module,
        } satisfies WorkspaceModulePlacement
      })
      .filter(notNull)

    const members = sortByOrder(memberRows.filter((row) => row.space_id === space.id)).map((row) => ({
      id: row.id,
      assigned_email: lowerEmail(row.assigned_email),
      profile_id: row.profile_id,
      member_label: row.member_label,
      sort_order: Number(row.sort_order ?? 100),
      profile: row.profile_id ? profilesById.get(row.profile_id) ?? null : profilesByEmail.get(lowerEmail(row.assigned_email)) ?? null,
    }))

    return {
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      color: normalizeColor(space.color),
      sort_order: Number(space.sort_order ?? 100),
      is_active: space.is_active !== false,
      layout: normalizeSpaceLayout(space.metadata, spaceIndex),
      modules: placements,
      links: [],
      members,
    } satisfies WorkspaceSpace
  })

  const placements = builtSpaces.flatMap((space) =>
    space.modules.map((placement) => ({
      placement,
      space,
    })),
  )
  const placementById = new Map(placements.map((entry) => [entry.placement.id, entry]))

  const visualLinks = sortByOrder(visualLinkRows)
    .map((row) => {
      const fromEntry = placementById.get(row.from_space_module_id)
      const toEntry = placementById.get(row.to_space_module_id)
      if (!fromEntry || !toEntry) return null
      return {
        id: row.id,
        from_space_module_id: row.from_space_module_id,
        to_space_module_id: row.to_space_module_id,
        sort_order: Number(row.sort_order ?? 100),
        from_space_id: fromEntry.space.id,
        to_space_id: toEntry.space.id,
        from_module: fromEntry.placement.module,
        to_module: toEntry.placement.module,
      } satisfies WorkspaceVisualLink
    })
    .filter(notNull)

  const combinedLinks = visualLinks.map((link) => ({
    id: link.id,
    space_id: link.from_space_id === link.to_space_id ? link.from_space_id : null,
    from_space_id: link.from_space_id,
    to_space_id: link.to_space_id,
    label: null,
    sort_order: link.sort_order,
    from: link.from_module,
    to: link.to_module,
    from_ref: {
      space_id: link.from_space_id,
      module_key: link.from_module.key,
      placement_key: placementKey(link.from_space_id, link.from_module.key),
    },
    to_ref: {
      space_id: link.to_space_id,
      module_key: link.to_module.key,
      placement_key: placementKey(link.to_space_id, link.to_module.key),
    },
    is_cross_space: link.from_space_id !== link.to_space_id,
  })) satisfies WorkspaceLink[]

  const linksBySpace = new Map<string, WorkspaceLink[]>()
  for (const link of combinedLinks) {
    if (link.from_space_id && link.from_space_id === link.to_space_id) {
      const current = linksBySpace.get(link.from_space_id) ?? []
      current.push(link)
      linksBySpace.set(link.from_space_id, current)
    }
  }

  const spacesWithLinks = builtSpaces.map((space) => ({
    ...space,
    links: linksBySpace.get(space.id) ?? [],
  }))

  const globalLinks = combinedLinks.filter((link) => link.from_space_id !== link.to_space_id)

  const graphNodes = sortByOrder(graphNodeRows)
    .map((row, index) => {
      const module = catalogByKey.get(row.module_key as WorkspaceModuleKey)
      if (!module) return null
      return {
        id: row.id,
        key: row.module_key as WorkspaceModuleKey,
        sort_order: Number(row.sort_order ?? 100),
        layout: normalizeGraphNodeLayout(row.metadata, index),
        module,
      } satisfies WorkspaceGraphNode
    })
    .filter(notNull)

  const graphLinks = sortByOrder(graphLinkRows)
    .map((row) => {
      const fromModule = catalogByKey.get(row.from_module_key as WorkspaceModuleKey)
      const toModule = catalogByKey.get(row.to_module_key as WorkspaceModuleKey)
      if (!fromModule || !toModule) return null
      return {
        id: row.id,
        from_module_key: row.from_module_key as WorkspaceModuleKey,
        to_module_key: row.to_module_key as WorkspaceModuleKey,
        sort_order: Number(row.sort_order ?? 100),
        from_module: fromModule,
        to_module: toModule,
      } satisfies WorkspaceGraphLink
    })
    .filter(notNull)

  return {
    spaces: spacesWithLinks,
    globalLinks,
    visualLinks,
    graphNodes,
    graphLinks,
    profiles: profileRows,
    catalog,
    customScreens,
    board: computeBoardSize(spacesWithLinks),
    graphBoard: computeGraphBoardSize(graphNodes),
  }
}

export async function getWorkspaceBuilderData(supabaseArg?: Awaited<ReturnType<typeof createClient>>): Promise<WorkspaceBuilderData> {
  const { spaces, globalLinks, visualLinks, graphNodes, graphLinks, profiles, catalog, customScreens, board, graphBoard } = await fetchWorkspaceTopology(supabaseArg)
  return {
    spaces,
    globalLinks,
    visualLinks,
    graphNodes,
    graphLinks,
    profiles,
    catalog,
    catalogGroups: catalogGroups(catalog),
    customScreens,
    board,
    graphBoard,
  }
}

export async function getAssignedWorkspaceSpaces(profile: MinimalProfile, supabaseArg?: Awaited<ReturnType<typeof createClient>>) {
  if (!profile.id || !isStaffRole(profile.role)) return []
  if (isExecutiveRole(profile.role)) {
    const { spaces } = await fetchWorkspaceTopology(supabaseArg)
    return spaces
  }

  const supabase = supabaseArg ?? (await createClient())
  const email = lowerEmail(profile.email)
  const [byIdRes, byEmailRes] = await Promise.all([
    supabase.from('workspace_space_members').select('space_id').eq('profile_id', profile.id),
    email ? supabase.from('workspace_space_members').select('space_id').eq('assigned_email', email) : Promise.resolve({ data: [] }),
  ])

  const memberships = [...asRows<{ space_id: string }>(byIdRes.data), ...asRows<{ space_id: string }>((byEmailRes as { data?: unknown }).data)]
  const spaceIds = unique(memberships.map((row) => row.space_id))

  if (!spaceIds.length) return []

  const { spaces } = await fetchWorkspaceTopology(supabase)
  return spaces.filter((space) => spaceIds.includes(space.id))
}

function dedupeNavItems(items: WorkspaceNavItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.key}:${item.href}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function getDashboardNavGroupsForProfile(profile: MinimalProfile, supabaseArg?: Awaited<ReturnType<typeof createClient>>): Promise<WorkspaceNavGroup[]> {
  if (!isStaffRole(profile.role)) return []

  const spaces = await getAssignedWorkspaceSpaces(profile, supabaseArg)

  if (isExecutiveRole(profile.role)) {
    const base = getDashboardNavGroups(profile.role) as WorkspaceNavGroup[]
    const customItems = dedupeNavItems(
      spaces.flatMap((space) =>
        space.modules
          .filter((placement) => placement.is_visible)
          .filter((placement) => placement.module.kind === 'custom' || isActiveDashboardModuleKey(placement.module.key as DashboardModuleKey))
          .map((placement) => ({
            key: placement.module.key,
            href: placement.module.href,
            label: placement.module.label,
            description: placement.module.description,
          })),
      ),
    )

    return customItems.length ? [...base, { title: 'Свои разделы', items: customItems }] : base
  }

  if (!spaces.length) {
    return getDashboardNavGroups(profile.role) as WorkspaceNavGroup[]
  }

  const cabinet = getDashboardModule('dashboard')
  const groups: WorkspaceNavGroup[] = []

  if (cabinet && isRoleAllowedForModule(profile.role, 'dashboard')) {
    groups.push({
      title: 'Кабинет',
      items: [
        {
          key: cabinet.key,
          href: cabinet.href,
          label: 'Мой рабочий стол',
          description: 'Стартовый экран: мои пространства, узкие места и быстрые входы.',
        },
      ],
    })
  }

  spaces.forEach((space) => {
    const items = space.modules
      .filter((module) => module.is_visible)
      .filter((module) => module.module.kind === 'custom' || isActiveDashboardModuleKey(module.module.key as DashboardModuleKey))
      .filter((module) => isWorkspaceModuleAllowed(profile.role, module.module))
      .map((module) => ({
        key: module.module.key,
        href: module.module.href,
        label: module.module.label,
        description: module.module.description,
      }))

    if (!items.length) return
    groups.push({ title: space.name, items: dedupeNavItems(items) })
  })

  return groups.length ? groups : (getDashboardNavGroups(profile.role) as WorkspaceNavGroup[])
}

export async function canAccessDashboardPathForProfile(
  profile: MinimalProfile,
  path: string,
  supabaseArg?: Awaited<ReturnType<typeof createClient>>,
) {
  if (!isStaffRole(profile.role)) return false
  if (path === '/dashboard') return true

  const spaces = await getAssignedWorkspaceSpaces(profile, supabaseArg)

  if (!spaces.length) {
    return getDashboardModules().some((module) => pathMatchesModule(path, makeBuiltinModuleDefinition(module)) && isRoleAllowedForModule(profile.role, module.key))
  }

  const modules = dedupeNavItems(
    spaces.flatMap((space) =>
      space.modules
        .filter((placement) => placement.is_visible)
        .filter((placement) => placement.module.kind === 'custom' || isActiveDashboardModuleKey(placement.module.key as DashboardModuleKey))
        .filter((placement) => isWorkspaceModuleAllowed(profile.role, placement.module))
        .map((placement) => ({
          key: placement.module.key,
          href: placement.module.href,
          label: placement.module.label,
          description: placement.module.description,
        })),
    ),
  )

  return modules.some((module) => path === module.href || path.startsWith(`${module.href}/`))
}

export async function getDashboardModuleKeysForProfile(profile: MinimalProfile, supabaseArg?: Awaited<ReturnType<typeof createClient>>) {
  if (!isStaffRole(profile.role)) return [] as WorkspaceModuleKey[]
  const spaces = await getAssignedWorkspaceSpaces(profile, supabaseArg)
  if (!spaces.length) {
    return getDashboardModules().filter((module) => isRoleAllowedForModule(profile.role, module.key)).map((module) => module.key) as WorkspaceModuleKey[]
  }

  return unique(
    spaces.flatMap((space) =>
      space.modules
        .filter((module) => module.is_visible)
        .filter((module) => isWorkspaceModuleAllowed(profile.role, module.module))
        .map((module) => module.key),
    ),
  )
}

export async function getCustomWorkspaceModuleScreenBySlug(
  slug: string,
  supabaseArg?: Awaited<ReturnType<typeof createClient>>,
): Promise<WorkspaceCustomModuleScreen | null> {
  const safeSlug = String(slug ?? '').trim()
  if (!safeSlug) return null
  const supabase = supabaseArg ?? (await createClient())
  const { data } = await supabase
    .from('workspace_custom_modules')
    .select('id, label, slug, description, color, metadata, is_active')
    .eq('slug', safeSlug)
    .eq('is_active', true)
    .maybeSingle()

  const row = data as WorkspaceCustomModuleRow | null
  if (!row) return null

  const module = makeCustomModuleDefinition(row)
  return {
    ...module,
    color: normalizeColor(row.color),
    metadata: normalizeCustomModuleLayout({
      title: row.label,
      description: row.description,
      route: module.href,
      metadata: row.metadata,
    }),
  }
}

export async function getCustomWorkspaceModuleBySlug(slug: string, supabaseArg?: Awaited<ReturnType<typeof createClient>>) {
  const safeSlug = String(slug ?? '').trim()
  if (!safeSlug) return null
  const supabase = supabaseArg ?? (await createClient())
  const { data } = await supabase
    .from('workspace_custom_modules')
    .select('id, label, slug, description, color, is_active')
    .eq('slug', safeSlug)
    .eq('is_active', true)
    .maybeSingle()

  const row = data as WorkspaceCustomModuleRow | null
  return row ? makeCustomModuleDefinition(row) : null
}

export async function getCustomWorkspaceModuleByKey(key: string, supabaseArg?: Awaited<ReturnType<typeof createClient>>) {
  const id = extractCustomId(key)
  if (!id) return null
  const supabase = supabaseArg ?? (await createClient())
  const { data } = await supabase
    .from('workspace_custom_modules')
    .select('id, label, slug, description, color, is_active')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()

  const row = data as WorkspaceCustomModuleRow | null
  return row ? makeCustomModuleDefinition(row) : null
}
