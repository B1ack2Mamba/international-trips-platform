import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getPortalCodeTtlMinutes,
  getPortalSessionCookieName,
  getPortalSessionTtlDays,
  shouldExposePortalCodeHint,
} from '@/lib/env'
import { queueTemplateMessage } from '@/lib/messaging'

export type PortalGateRecord = {
  id: string
  participant_name: string
  guardian_name: string | null
  guardian_email: string | null
  portal_access_enabled: boolean
  portal_access_expires_at: string | null
  portal_auth_mode: 'link' | 'otp_required'
  departure?: { departure_name: string | null; start_date?: string | null; end_date?: string | null } | null
  deal?: { program?: { title: string | null } | null } | null
}

function hashValue(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function generateSixDigitCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

function formatDateTimeDisplay(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value)
}

export function isPortalRecordActive(enabled: boolean | null | undefined, expiresAt: string | null | undefined) {
  if (!enabled) return false
  if (!expiresAt) return true
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return true
  return date.getTime() > Date.now()
}

export async function getPortalGateByToken(token: string): Promise<PortalGateRecord | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('applications')
    .select(`id, participant_name, guardian_name, guardian_email,
      portal_access_enabled, portal_access_expires_at, portal_auth_mode,
      departure:departures(departure_name, start_date, end_date),
      deal:deals(program:programs(title))`)
    .eq('portal_access_token', token)
    .maybeSingle()

  return (data as PortalGateRecord | null) ?? null
}

export async function requestPortalAccessCode(token: string, email: string) {
  const admin = createAdminClient()
  const normalizedEmail = email.trim().toLowerCase()
  const application = await getPortalGateByToken(token)

  if (!application || !isPortalRecordActive(application.portal_access_enabled, application.portal_access_expires_at)) {
    return { ok: false as const, error: 'portal_not_available' }
  }

  if (!application.guardian_email) {
    return { ok: false as const, error: 'guardian_email_not_configured' }
  }

  if (application.guardian_email.trim().toLowerCase() !== normalizedEmail) {
    return { ok: false as const, error: 'email_mismatch' }
  }

  const code = generateSixDigitCode()
  const expiresAt = new Date(Date.now() + getPortalCodeTtlMinutes() * 60_000)

  await admin
    .from('portal_login_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('application_id', application.id)
    .eq('email', normalizedEmail)
    .is('consumed_at', null)

  const { error } = await admin.from('portal_login_codes').insert({
    application_id: application.id,
    email: normalizedEmail,
    code_hash: hashValue(code),
    delivery_channel: 'email',
    expires_at: expiresAt.toISOString(),
    metadata: { source: 'portal_request_access_code' },
  })

  if (error) {
    return { ok: false as const, error: error.message }
  }

  const programTitle = application.deal?.program?.title ?? 'Программа'
  const departureName = application.departure?.departure_name ?? 'Выезд будет уточнён'

  try {
    await queueTemplateMessage({
      templateCode: 'portal_access_code',
      applicationId: application.id,
      recipientName: application.guardian_name,
      recipientEmail: normalizedEmail,
      payload: {
        participant_name: application.participant_name,
        guardian_name: application.guardian_name ?? 'родитель',
        program_title: programTitle,
        departure_name: departureName,
        access_code: code,
        expires_at_display: formatDateTimeDisplay(expiresAt),
      },
      metadata: {
        portal_token: token,
      },
    })
  } catch (messageError) {
    return { ok: false as const, error: String(messageError) }
  }

  return {
    ok: true as const,
    expiresAt: expiresAt.toISOString(),
    codeHint: shouldExposePortalCodeHint() ? code : null,
  }
}

export async function verifyPortalAccessCode(token: string, email: string, code: string) {
  const admin = createAdminClient()
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedCode = code.trim()
  const application = await getPortalGateByToken(token)

  if (!application || !isPortalRecordActive(application.portal_access_enabled, application.portal_access_expires_at)) {
    return { ok: false as const, error: 'portal_not_available' }
  }

  if (!application.guardian_email || application.guardian_email.trim().toLowerCase() !== normalizedEmail) {
    return { ok: false as const, error: 'email_mismatch' }
  }

  const { data: codes, error } = await admin
    .from('portal_login_codes')
    .select('id, code_hash, expires_at, consumed_at, attempts, created_at')
    .eq('application_id', application.id)
    .eq('email', normalizedEmail)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error || !codes?.length) {
    return { ok: false as const, error: error?.message ?? 'code_not_found' }
  }

  const loginCode = codes[0]
  const expiresAt = new Date(loginCode.expires_at)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return { ok: false as const, error: 'code_expired' }
  }

  if (hashValue(normalizedCode) !== loginCode.code_hash) {
    await admin
      .from('portal_login_codes')
      .update({ attempts: (loginCode.attempts ?? 0) + 1 })
      .eq('id', loginCode.id)

    return { ok: false as const, error: 'invalid_code' }
  }

  await admin
    .from('portal_login_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', loginCode.id)

  const sessionToken = `${crypto.randomUUID()}${crypto.randomBytes(12).toString('hex')}`
  const sessionHash = hashValue(sessionToken)
  const sessionExpiresAt = new Date(Date.now() + getPortalSessionTtlDays() * 24 * 60 * 60_000)

  const { error: sessionError } = await admin.from('portal_sessions').insert({
    application_id: application.id,
    session_hash: sessionHash,
    expires_at: sessionExpiresAt.toISOString(),
    last_seen_at: new Date().toISOString(),
    metadata: {
      source: 'portal_access_code',
      guardian_email: normalizedEmail,
    },
  })

  if (sessionError) {
    return { ok: false as const, error: sessionError.message }
  }

  const cookieStore = await cookies()
  cookieStore.set(getPortalSessionCookieName(), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: sessionExpiresAt,
  })

  await admin
    .from('applications')
    .update({ portal_last_opened_at: new Date().toISOString() })
    .eq('id', application.id)

  return { ok: true as const }
}

export async function hasValidPortalSession(applicationId: string) {
  const cookieStore = await cookies()
  const rawSession = cookieStore.get(getPortalSessionCookieName())?.value
  if (!rawSession) return false

  const admin = createAdminClient()
  const sessionHash = hashValue(rawSession)
  const { data: session } = await admin
    .from('portal_sessions')
    .select('id, expires_at, revoked_at')
    .eq('application_id', applicationId)
    .eq('session_hash', sessionHash)
    .maybeSingle()

  if (!session || session.revoked_at) {
    return false
  }

  const expiresAt = new Date(session.expires_at)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return false
  }

  await admin
    .from('portal_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', session.id)

  return true
}


export async function hasPortalTokenAccess(token: string) {
  const application = await getPortalGateByToken(token)
  if (!application || !isPortalRecordActive(application.portal_access_enabled, application.portal_access_expires_at)) {
    return { ok: false as const, error: 'portal_not_available', application: null }
  }

  if (application.portal_auth_mode === 'otp_required') {
    const sessionOk = await hasValidPortalSession(application.id)
    if (!sessionOk) {
      return { ok: false as const, error: 'otp_required', application }
    }
  }

  return { ok: true as const, application }
}

export async function clearPortalSession() {
  const cookieStore = await cookies()
  const rawSession = cookieStore.get(getPortalSessionCookieName())?.value
  if (!rawSession) return

  const admin = createAdminClient()
  const sessionHash = hashValue(rawSession)
  await admin
    .from('portal_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('session_hash', sessionHash)

  cookieStore.set(getPortalSessionCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  })
}
