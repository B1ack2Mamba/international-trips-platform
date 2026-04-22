function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getSupabaseUrl() {
  return required('NEXT_PUBLIC_SUPABASE_URL')
}

export function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? required('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function getSupabaseServiceRoleKey() {
  return required('SUPABASE_SERVICE_ROLE_KEY')
}

export function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return 'http://localhost:3000'
}

export function getPortalDocumentsBucket() {
  return process.env.NEXT_PUBLIC_PORTAL_DOCUMENTS_BUCKET ?? 'portal-documents'
}

export function getPortalSessionCookieName() {
  return process.env.NEXT_PUBLIC_PORTAL_SESSION_COOKIE_NAME ?? 'portal_session'
}

export function getPortalCodeTtlMinutes() {
  const raw = Number(process.env.PORTAL_CODE_TTL_MINUTES ?? 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 10
}

export function getPortalSessionTtlDays() {
  const raw = Number(process.env.PORTAL_SESSION_TTL_DAYS ?? 7)
  return Number.isFinite(raw) && raw > 0 ? raw : 7
}

export function shouldExposePortalCodeHint() {
  return process.env.NODE_ENV !== 'production' || process.env.EXPOSE_PORTAL_CODE_HINT === 'true'
}


export function getMessageDispatchWebhookUrl() {
  return process.env.MESSAGE_DISPATCH_WEBHOOK_URL ?? null
}

export function getMessageDispatchWebhookSecret() {
  return process.env.MESSAGE_DISPATCH_WEBHOOK_TOKEN ?? null
}

export function isMessageDispatchDryRun() {
  return process.env.MESSAGE_DISPATCH_DRY_RUN === 'true'
}

export function getMessageDispatchBatchSize() {
  const raw = Number(process.env.MESSAGE_DISPATCH_BATCH_SIZE ?? 20)
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : 20
}

export type EmailProvider = 'resend' | 'sendgrid'

export function getEmailProvider(): EmailProvider | null {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase()
  if (provider === 'resend' || provider === 'sendgrid') return provider
  if (process.env.RESEND_API_KEY) return 'resend'
  if (process.env.SENDGRID_API_KEY) return 'sendgrid'
  return null
}

export function getEmailFromAddress(provider: EmailProvider) {
  if (provider === 'resend') {
    return process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM ?? null
  }

  return process.env.SENDGRID_FROM_EMAIL ?? process.env.EMAIL_FROM ?? null
}

export function getEmailFromName(provider: EmailProvider) {
  if (provider === 'resend') {
    return process.env.RESEND_FROM_NAME ?? process.env.EMAIL_FROM_NAME ?? 'International Trips Platform'
  }

  return process.env.SENDGRID_FROM_NAME ?? process.env.EMAIL_FROM_NAME ?? 'International Trips Platform'
}

export function getResendApiKey() {
  return process.env.RESEND_API_KEY ?? null
}

export function getSendgridApiKey() {
  return process.env.SENDGRID_API_KEY ?? null
}

export function getCronSecret() {
  return process.env.CRON_SECRET ?? null
}
