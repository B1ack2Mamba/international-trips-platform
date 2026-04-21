'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/env'
import { isStaffRole } from '@/lib/roles'
import { ensureWorkspaceInvitationProfile } from '@/lib/workspace-invitations'

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function login(formData: FormData) {
  const email = getString(formData, 'email')
  const password = getString(formData, 'password')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent('Неверный email или пароль.')}`)
  }

  await ensureWorkspaceInvitationProfile(data.user.id, data.user.email ?? email)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile?.is_active || !isStaffRole(profile.role)) {
    await supabase.auth.signOut()
    redirect(
      `/login?error=${encodeURIComponent(
        'Аккаунт найден, но у него нет активного доступа к CRM. Проверьте роль и is_active в profiles.',
      )}`,
    )
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const email = getString(formData, 'email')
  const password = getString(formData, 'password')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
    },
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  if (data.user) {
    await ensureWorkspaceInvitationProfile(data.user.id, data.user.email ?? email)
  }

  revalidatePath('/', 'layout')
  redirect('/login?status=signup')
}
