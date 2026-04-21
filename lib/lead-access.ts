import { createAdminClient } from '@/lib/supabase/admin'

const LEAD_ROLE_KEYS = ['owner', 'admin', 'sales_head', 'sales_manager', 'marketing', 'partner_manager', 'sales'] as const

export type LeadAssignableProfile = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
}

function lower(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase()
}

export async function getLeadAssignableProfiles(): Promise<LeadAssignableProfile[]> {
  const admin = createAdminClient()
  const [
    profilesRes,
    leadModuleSpacesRes,
    membersRes,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    admin
      .from('workspace_space_modules')
      .select('space_id')
      .in('module_key', ['leads', 'my_leads'])
      .eq('is_visible', true),
    admin
      .from('workspace_space_members')
      .select('space_id, profile_id, assigned_email'),
  ])

  const profiles = ((profilesRes.data ?? []) as Array<LeadAssignableProfile & { is_active: boolean | null }>)
    .filter((profile) => profile.is_active)

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const profileByEmail = new Map(profiles.map((profile) => [lower(profile.email), profile]))
  const leadSpaceIds = new Set(((leadModuleSpacesRes.data ?? []) as { space_id: string }[]).map((row) => row.space_id))
  const allowedIds = new Set<string>()

  for (const profile of profiles) {
    if (LEAD_ROLE_KEYS.includes(profile.role as (typeof LEAD_ROLE_KEYS)[number])) {
      allowedIds.add(profile.id)
    }
  }

  for (const member of (membersRes.data ?? []) as { profile_id: string | null; assigned_email: string | null; space_id?: string | null }[]) {
    if (member.space_id && !leadSpaceIds.has(member.space_id)) continue
    if (member.profile_id && profileById.has(member.profile_id)) allowedIds.add(member.profile_id)
    const byEmail = profileByEmail.get(lower(member.assigned_email))
    if (byEmail) allowedIds.add(byEmail.id)
  }

  return Array.from(allowedIds)
    .map((id) => profileById.get(id))
    .filter((profile): profile is LeadAssignableProfile & { is_active: boolean | null } => Boolean(profile))
    .map(({ is_active, ...profile }) => profile)
}
