import { z } from 'zod'
import { NextResponse } from 'next/server'
import { hasServiceRole } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { queueTemplateMessage } from '@/lib/messaging'

const sourceChannels = ['website', 'telegram', 'landing', 'partner', 'referral', 'manual'] as const

type LeadSource = (typeof sourceChannels)[number]

type PartnerAttribution = {
  id: string
  partner_account_id: string
  code: string
  label: string
  lock_days: number
  partner_name: string | null
  partner_email: string | null
}

const schema = z.object({
  program_slug: z.string().optional().or(z.literal('')),
  contact_name_raw: z.string().min(2),
  phone_raw: z.string().min(5),
  email_raw: z.string().email().optional().or(z.literal('')),
  desired_country: z.string().optional().or(z.literal('')),
  desired_departure_id: z.string().uuid().optional().or(z.literal('')),
  source_channel: z.string().optional().or(z.literal('')),
  message: z.string().optional().or(z.literal('')),
  website: z.string().optional().or(z.literal('')),
  utm_source: z.string().optional().or(z.literal('')),
  utm_medium: z.string().optional().or(z.literal('')),
  utm_campaign: z.string().optional().or(z.literal('')),
  utm_content: z.string().optional().or(z.literal('')),
  utm_term: z.string().optional().or(z.literal('')),
  referrer_url: z.string().url().optional().or(z.literal('')),
  partner_code: z.string().optional().or(z.literal('')),
})

type LeadInput = z.infer<typeof schema>

function normalizeSourceChannel(value?: string | null): LeadSource {
  if (!value) return 'website'
  return (sourceChannels.includes(value as LeadSource) ? value : 'website') as LeadSource
}

function normalizePhone(value?: string | null) {
  return (value ?? '').replace(/\D+/g, '') || null
}

function normalizeEmail(value?: string | null) {
  const email = (value ?? '').trim().toLowerCase()
  return email || null
}

function normalizePartnerCode(value?: string | null) {
  return (value ?? '').trim().toLowerCase() || null
}

async function parseRequest(request: Request): Promise<{ isJson: boolean; data: unknown }> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return { isJson: true, data: await request.json() }
  }

  const formData = await request.formData()
  return { isJson: false, data: Object.fromEntries(formData.entries()) }
}

function buildMetadata(
  request: Request,
  input: LeadInput,
  duplicateLeadId: string | null,
  partner: PartnerAttribution | null,
) {
  return {
    utm: {
      source: input.utm_source || null,
      medium: input.utm_medium || null,
      campaign: input.utm_campaign || null,
      content: input.utm_content || null,
      term: input.utm_term || null,
    },
    referrer_url: input.referrer_url || request.headers.get('referer') || null,
    user_agent: request.headers.get('user-agent') || null,
    duplicate_of_lead_id: duplicateLeadId,
    intake_origin: 'app_api_public_lead',
    partner: partner
      ? {
          id: partner.id,
          account_id: partner.partner_account_id,
          code: partner.code,
          label: partner.label,
          partner_name: partner.partner_name,
        }
      : null,
  }
}

async function findProgramId(programSlug: string | undefined) {
  if (!programSlug) return null

  const supabase = await createClient()
  const { data } = await supabase.from('programs').select('id').eq('public_slug', programSlug).maybeSingle()

  return data?.id ?? null
}

async function findDuplicateLeadId(input: LeadInput) {
  if (!hasServiceRole()) return null

  const normalizedPhone = normalizePhone(input.phone_raw)
  const normalizedEmail = normalizeEmail(input.email_raw)

  if (!normalizedPhone && !normalizedEmail) return null

  const admin = createAdminClient()

  let query = admin.from('leads').select('id').order('created_at', { ascending: false }).limit(1)

  if (normalizedPhone && normalizedEmail) {
    query = query.or(`normalized_phone.eq.${normalizedPhone},normalized_email.eq.${normalizedEmail}`)
  } else if (normalizedPhone) {
    query = query.eq('normalized_phone', normalizedPhone)
  } else if (normalizedEmail) {
    query = query.eq('normalized_email', normalizedEmail)
  }

  const { data } = await query.maybeSingle()
  return data?.id ?? null
}

async function findPartnerAttribution(rawPartnerCode: string | undefined) {
  if (!hasServiceRole()) return null

  const partnerCode = normalizePartnerCode(rawPartnerCode)
  if (!partnerCode) return null

  const admin = createAdminClient()
  const { data: codeRow } = await admin
    .from('partner_referral_codes')
    .select('id, partner_account_id, code, label, lock_days, status, partner:accounts(display_name)')
    .eq('code', partnerCode)
    .eq('status', 'active')
    .maybeSingle()

  if (!codeRow) return null

  const { data: contact } = await admin
    .from('contacts')
    .select('email')
    .eq('account_id', codeRow.partner_account_id)
    .eq('is_primary', true)
    .maybeSingle()

  return {
    id: codeRow.id,
    partner_account_id: codeRow.partner_account_id,
    code: codeRow.code,
    label: codeRow.label,
    lock_days: codeRow.lock_days,
    partner_name: (codeRow.partner as { display_name?: string | null } | null)?.display_name ?? null,
    partner_email: contact?.email ?? null,
  } satisfies PartnerAttribution
}

function successJson(extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: true, ...extra })
}

function errorJson(status: number, message: string, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status })
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const { isJson, data } = await parseRequest(request)
  const result = schema.safeParse(data)
  const unsafeProgramSlug =
    typeof data === 'object' && data !== null && 'program_slug' in data
      ? String((data as Record<string, unknown>).program_slug ?? '')
      : ''
  const programSlug = result.success ? result.data.program_slug || '' : unsafeProgramSlug

  if (!result.success) {
    if (isJson) return errorJson(400, 'validation_failed', result.error.flatten())
    return NextResponse.redirect(new URL(`/programs/${programSlug}?status=error`, url.origin))
  }

  if (result.data.website) {
    if (isJson) return successJson({ honeypot: true })
    return NextResponse.redirect(new URL(`/programs/${programSlug}?status=success`, url.origin))
  }

  const desiredProgramId = await findProgramId(result.data.program_slug || undefined)
  const duplicateLeadId = await findDuplicateLeadId(result.data)
  const partner = await findPartnerAttribution(result.data.partner_code || undefined)
  const metadata = buildMetadata(request, result.data, duplicateLeadId, partner)
  const sourceChannel = partner ? 'partner' : normalizeSourceChannel(result.data.source_channel)

  const supabase = hasServiceRole() ? createAdminClient() : await createClient()
  const { data: inserted, error } = await supabase
    .from('leads')
    .insert({
      desired_program_id: desiredProgramId,
      desired_departure_id: result.data.desired_departure_id || null,
      contact_name_raw: result.data.contact_name_raw,
      phone_raw: result.data.phone_raw,
      email_raw: result.data.email_raw || null,
      desired_country: result.data.desired_country || null,
      source_channel: sourceChannel,
      source_detail: partner?.code || result.data.program_slug || 'public-intake',
      status: duplicateLeadId ? 'duplicate' : 'new',
      message: result.data.message || null,
      metadata,
      partner_account_id: partner?.partner_account_id ?? null,
      partner_referral_code_id: partner?.id ?? null,
      ownership_lock_status: partner ? 'partner_owned' : 'none',
      ownership_locked_until: partner ? new Date(Date.now() + partner.lock_days * 24 * 60 * 60_000).toISOString() : null,
      ownership_note: partner ? `Автоматически атрибутировано по коду ${partner.code}` : null,
    })
    .select('id, status')
    .maybeSingle()

  if (error) {
    if (isJson) return errorJson(400, error.message)
    return NextResponse.redirect(new URL(`/programs/${programSlug}?status=error`, url.origin))
  }

  if (partner?.partner_email && inserted?.id) {
    try {
      await queueTemplateMessage({
        templateCode: 'partner_lead_registered',
        leadId: inserted.id,
        partnerAccountId: partner.partner_account_id,
        recipientName: partner.partner_name,
        recipientEmail: partner.partner_email,
        payload: {
          partner_code: partner.code,
          contact_name: result.data.contact_name_raw,
          phone: result.data.phone_raw,
          desired_country: result.data.desired_country || '—',
          program_title: result.data.program_slug || '—',
        },
        metadata: {
          auto: true,
          source: 'public_lead_route',
        },
      })
    } catch {
      // queue failure should not block lead capture
    }
  }

  if (isJson) {
    return successJson({
      lead_id: inserted?.id ?? null,
      status: inserted?.status ?? 'new',
      duplicate_of_lead_id: duplicateLeadId,
      partner_account_id: partner?.partner_account_id ?? null,
    })
  }

  return NextResponse.redirect(new URL(`/programs/${programSlug}?status=success`, url.origin))
}
