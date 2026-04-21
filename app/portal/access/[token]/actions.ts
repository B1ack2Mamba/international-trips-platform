'use server'

import { redirect } from 'next/navigation'
import { clearPortalSession, requestPortalAccessCode, verifyPortalAccessCode } from '@/lib/portal-auth'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function requestPortalCodeAction(formData: FormData) {
  const token = value(formData, 'token')
  const email = value(formData, 'email')
  const result = await requestPortalAccessCode(token, email)

  if (!result.ok) {
    redirect(`/portal/access/${token}?status=error&reason=${encodeURIComponent(result.error)}&email=${encodeURIComponent(email)}`)
  }

  const params = new URLSearchParams({
    status: 'code_sent',
    email,
  })

  if (result.codeHint) {
    params.set('code_hint', result.codeHint)
  }

  redirect(`/portal/access/${token}?${params.toString()}`)
}

export async function verifyPortalCodeAction(formData: FormData) {
  const token = value(formData, 'token')
  const email = value(formData, 'email')
  const code = value(formData, 'code')
  const result = await verifyPortalAccessCode(token, email, code)

  if (!result.ok) {
    redirect(`/portal/access/${token}?status=error&reason=${encodeURIComponent(result.error)}&email=${encodeURIComponent(email)}`)
  }

  redirect(`/portal/${token}`)
}

export async function signOutPortalAction(formData: FormData) {
  const token = value(formData, 'token')
  await clearPortalSession()
  redirect(`/portal/access/${token}?status=signed_out`)
}
