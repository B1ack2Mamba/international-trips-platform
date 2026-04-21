import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceBuilderData } from '@/lib/influence-spaces'
import { getDashboardModule, isAdminRole, type DashboardModuleKey } from '@/lib/roles'

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status })
}

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeColor(value: unknown, fallback = '#7dd3fc') {
  const color = normalizeText(value)
  return /^#[0-9a-fA-F]{3,6}$/.test(color) ? color : fallback
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

async function requireWorkspaceBuilderAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: json(401, { error: 'auth_required' }) as NextResponse }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_active) {
    return { error: json(403, { error: 'inactive_profile' }) as NextResponse }
  }

  if (!isAdminRole(profile.role)) {
    return { error: json(403, { error: 'forbidden' }) as NextResponse }
  }

  return { supabase, user, profile }
}

async function snapshot(supabase: Awaited<ReturnType<typeof createClient>>) {
  const data = await getWorkspaceBuilderData(supabase)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard', 'layout')
  revalidatePath('/dashboard/spaces')
  return json(200, { ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireWorkspaceBuilderAccess()
  if ('error' in access) return access.error

  const { supabase, user } = access
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return json(400, { error: 'invalid_body' })
  }

  const action = normalizeText(body.action)

  if (action === 'create_space') {
    const { data: currentSpaces } = await supabase.from('workspace_spaces').select('sort_order').order('sort_order', { ascending: false }).limit(1)
    const sortOrder = Number((currentSpaces?.[0] as { sort_order?: number } | undefined)?.sort_order ?? 0) + 10
    const palette = ['#8b5cf6', '#10b981', '#f59e0b', '#38bdf8', '#ec4899', '#22c55e', '#fb7185', '#6366f1']
    const color = palette[Math.abs(sortOrder / 10) % palette.length]
    const name = normalizeText(body.name) || `Новая зона ${Math.max(1, sortOrder / 10)}`
    const slugBase = slugify(name || `space-${Date.now()}`) || `space-${Date.now()}`
    let slug = slugBase
    let suffix = 2
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: exists } = await supabase.from('workspace_spaces').select('id').eq('slug', slug).maybeSingle()
      if (!exists) break
      slug = `${slugBase}-${suffix++}`
    }

    const { error } = await supabase.from('workspace_spaces').insert({
      name,
      slug,
      color,
      sort_order: sortOrder,
      created_by_user_id: user.id,
    })

    if (error) return json(400, { error: error.message })
    return snapshot(supabase)
  }

  if (action === 'update_space') {
    const id = normalizeText(body.id)
    if (!id) return json(400, { error: 'space_id_required' })

    const patch: Record<string, unknown> = {}
    if ('name' in body) {
      const name = normalizeText(body.name)
      if (name) patch.name = name
    }
    if ('color' in body) patch.color = normalizeColor(body.color)
    if ('description' in body) patch.description = normalizeText(body.description) || null

    const { error } = await supabase.from('workspace_spaces').update(patch).eq('id', id)
    if (error) return json(400, { error: error.message })
    return snapshot(supabase)
  }

  if (action === 'delete_space') {
    const id = normalizeText(body.id)
    if (!id) return json(400, { error: 'space_id_required' })
    const { error } = await supabase.from('workspace_spaces').delete().eq('id', id)
    if (error) return json(400, { error: error.message })
    return snapshot(supabase)
  }

  if (action === 'add_member') {
    const spaceId = normalizeText(body.space_id)
    const email = normalizeEmail(body.email)
    if (!spaceId || !email) return json(400, { error: 'space_id_and_email_required' })

    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
    const { error } = await supabase.from('workspace_space_members').upsert(
      {
        space_id: spaceId,
        assigned_email: email,
        profile_id: profile?.id ?? null,
        sort_order: 100,
      },
      { onConflict: 'space_id,assigned_email' },
    )
    if (error) return json(400, { error: error.message })
    return snapshot(supabase)
  }

  if (action === 'remove_member') {
    const id = normalizeText(body.id)
    if (!id) return json(400, { error: 'member_id_required' })
    const { error } = await supabase.from('workspace_space_members').delete().eq('id', id)
    if (error) return json(400, { error: error.message })
    return snapshot(supabase)
  }

  if (action === 'add_module') {
    const spaceId = normalizeText(body.space_id)
    const moduleKey = normalizeText(body.module_key) as DashboardModuleKey
    if (!spaceId || !moduleKey || !getDashboardModule(moduleKey)) return json(400, { error: 'space_id_and_valid_module_key_required' })

    const { data: currentRows } = await supabase
      .from('workspace_space_modules')
      .select('sort_order')
      .eq('space_id', spaceId)
      .order('sort_order', { ascending: false })
      .limit(1)
    const sortOrder = Number((currentRows?.[0] as { sort_order?: number } | undefined)?.sort_order ?? 0) + 10

    const { error } = await supabase.from('workspace_space_modules').upsert(
      {
        space_id: spaceId,
        module_key: moduleKey,
        sort_order: sortOrder,
        is_visible: true,
      },
      { onConflict: 'space_id,module_key' },
    )
    if (error) return json(400, { error: error.message })
    return snapshot(supabase)
  }

  if (action === 'remove_module') {
    const id = normalizeText(body.id)
    if (!id) return json(400, { error: 'module_id_required' })
    const { error } = await supabase.from('workspace_space_modules').delete().eq('id', id)
    if (error) return json(400, { error: error.message })
    return snapshot(supabase)
  }

  if (action === 'move_module') {
    const id = normalizeText(body.id)
    const targetSpaceId = normalizeText(body.target_space_id)
    if (!id || !targetSpaceId) return json(400, { error: 'module_id_and_target_space_id_required' })

    const { data: current } = await supabase
      .from('workspace_space_modules')
      .select('id, space_id, module_key')
      .eq('id', id)
      .maybeSingle()

    if (!current) return json(404, { error: 'module_not_found' })

    const { data: targetExisting } = await supabase
      .from('workspace_space_modules')
      .select('id')
      .eq('space_id', targetSpaceId)
      .eq('module_key', current.module_key)
      .maybeSingle()

    const { data: currentRows } = await supabase
      .from('workspace_space_modules')
      .select('sort_order')
      .eq('space_id', targetSpaceId)
      .order('sort_order', { ascending: false })
      .limit(1)
    const sortOrder = Number((currentRows?.[0] as { sort_order?: number } | undefined)?.sort_order ?? 0) + 10

    if (targetExisting?.id && targetExisting.id !== id) {
      const removeError = await supabase.from('workspace_space_modules').delete().eq('id', id)
      if (removeError.error) return json(400, { error: removeError.error.message })
    } else {
      const { error } = await supabase
        .from('workspace_space_modules')
        .update({ space_id: targetSpaceId, sort_order: sortOrder })
        .eq('id', id)
      if (error) return json(400, { error: error.message })
    }

    await Promise.all([
      supabase
        .from('workspace_space_links')
        .update({ from_space_id: targetSpaceId, space_id: null })
        .eq('from_space_id', current.space_id)
        .eq('from_module_key', current.module_key),
      supabase
        .from('workspace_space_links')
        .update({ to_space_id: targetSpaceId, space_id: null })
        .eq('to_space_id', current.space_id)
        .eq('to_module_key', current.module_key),
    ])

    return snapshot(supabase)
  }

  if (action === 'create_link') {
    const fromSpaceId = normalizeText(body.from_space_id) || null
    const toSpaceId = normalizeText(body.to_space_id) || null
    const fromModuleKey = normalizeText(body.from_module_key) as DashboardModuleKey
    const toModuleKey = normalizeText(body.to_module_key) as DashboardModuleKey
    if (!fromModuleKey || !toModuleKey || fromModuleKey === toModuleKey) return json(400, { error: 'invalid_link' })

    const { data: existing } = await supabase
      .from('workspace_space_links')
      .select('id')
      .eq('from_module_key', fromModuleKey)
      .eq('to_module_key', toModuleKey)
      .eq('from_space_id', fromSpaceId)
      .eq('to_space_id', toSpaceId)
      .maybeSingle()

    if (!existing) {
      const { error } = await supabase.from('workspace_space_links').insert({
        space_id: fromSpaceId && toSpaceId && fromSpaceId === toSpaceId ? fromSpaceId : null,
        from_space_id: fromSpaceId,
        to_space_id: toSpaceId,
        from_module_key: fromModuleKey,
        to_module_key: toModuleKey,
        label: normalizeText(body.label) || null,
        sort_order: 100,
      })
      if (error) return json(400, { error: error.message })
    }

    return snapshot(supabase)
  }

  if (action === 'remove_link') {
    const id = normalizeText(body.id)
    if (!id) return json(400, { error: 'link_id_required' })
    const { error } = await supabase.from('workspace_space_links').delete().eq('id', id)
    if (error) return json(400, { error: error.message })
    return snapshot(supabase)
  }

  return json(400, { error: 'unknown_action' })
}
