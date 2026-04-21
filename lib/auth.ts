import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canPerform, isPartnerOrStaffRole, isPartnerRole, isStaffRole, type AppAbility } from '@/lib/roles'
import { canAccessDashboardPathForProfile } from '@/lib/influence-spaces'

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  role: string | null
  locale: string | null
  timezone: string | null
  is_active: boolean | null
  partner_account_id?: string | null
}

export async function getAuthContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, profile: null as Profile | null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, role, locale, timezone, is_active, partner_account_id')
    .eq('id', user.id)
    .maybeSingle()

  return { supabase, user, profile: profile as Profile | null }
}

export async function requireAuth() {
  const context = await getAuthContext()

  if (!context.user) {
    redirect('/login')
  }

  return context
}

export async function requireStaff() {
  const context = await requireAuth()

  if (!context.profile?.is_active) {
    redirect('/unauthorized')
  }

  if (!isStaffRole(context.profile?.role)) {
    redirect('/unauthorized')
  }

  return context
}

export async function requireDashboardAccess(path: string) {
  const context = await requireStaff()

  const allowed = await canAccessDashboardPathForProfile(
    {
      id: context.user!.id,
      email: context.profile?.email ?? context.user?.email ?? null,
      role: context.profile?.role ?? null,
    },
    path,
    context.supabase,
  )

  if (!allowed) {
    redirect('/unauthorized')
  }

  return context
}

export async function requireAbility(path: string, ability: AppAbility) {
  const context = await requireDashboardAccess(path)

  if (!canPerform(context.profile?.role, ability)) {
    redirect('/unauthorized')
  }

  return context
}

export async function requirePartner() {
  const context = await requireAuth()

  if (!context.profile?.is_active) {
    redirect('/unauthorized')
  }

  if (!isPartnerRole(context.profile?.role)) {
    redirect('/unauthorized')
  }

  return context
}

export async function requirePartnerOrStaff() {
  const context = await requireAuth()

  if (!context.profile?.is_active) {
    redirect('/unauthorized')
  }

  if (!isPartnerOrStaffRole(context.profile?.role)) {
    redirect('/unauthorized')
  }

  return context
}
