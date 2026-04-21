import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/env'
import { isPartnerRole } from '@/lib/roles'
import { canAccessDashboardPathForProfile } from '@/lib/influence-spaces'

function redirectTo(path: string, request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = path
  url.search = ''
  return NextResponse.redirect(url)
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))

        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const pathname = request.nextUrl.pathname
  const protectedDashboard = pathname.startsWith('/dashboard')
  const protectedPartner = pathname.startsWith('/partner')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if ((protectedDashboard || protectedPartner) && !user) {
    return redirectTo('/login', request)
  }

  if (!protectedDashboard && !protectedPartner) {
    return response
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, email')
    .eq('id', user!.id)
    .maybeSingle()

  if (!profile?.is_active) {
    return redirectTo('/unauthorized', request)
  }

  if (protectedDashboard) {
    const allowed = await canAccessDashboardPathForProfile(
      { id: user!.id, email: profile.email ?? user?.email ?? null, role: profile.role ?? null },
      pathname,
      supabase as any,
    )

    if (!allowed) {
      return redirectTo('/unauthorized', request)
    }
  }

  if (protectedPartner && !isPartnerRole(profile.role)) {
    return redirectTo('/unauthorized', request)
  }

  return response
}
