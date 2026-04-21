import { isStaffRole } from '@/lib/roles'
import { createAdminClient } from '@/lib/supabase/admin'

function normalizeEmail(email: string | null | undefined) {
  return String(email ?? '').trim().toLowerCase()
}

export async function ensureWorkspaceInvitationProfile(userId: string, email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email)
  if (!userId || !normalizedEmail) return false

  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from('workspace_space_members')
    .select('id')
    .eq('assigned_email', normalizedEmail)
    .limit(1)

  if (!memberships?.length) return false

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', userId)
    .maybeSingle()

  const nextRole = isStaffRole(profile?.role) ? profile?.role : 'sales'

  await admin.from('profiles').upsert(
    {
      id: userId,
      email: normalizedEmail,
      role: nextRole,
      is_active: true,
    },
    { onConflict: 'id' },
  )

  await admin
    .from('workspace_space_members')
    .update({ profile_id: userId })
    .eq('assigned_email', normalizedEmail)

  return true
}
