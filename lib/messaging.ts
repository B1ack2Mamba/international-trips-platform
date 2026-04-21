import { createAdminClient } from '@/lib/supabase/admin'

export type TemplatePayload = Record<string, string | number | null | undefined>

function stringifyValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function renderTemplate(template: string | null | undefined, payload: TemplatePayload) {
  let output = template ?? ''
  for (const [key, value] of Object.entries(payload)) {
    output = output.replaceAll(`{{${key}}}`, stringifyValue(value))
  }
  return output.replace(/\{\{[^}]+\}\}/g, '—')
}

export async function queueTemplateMessage(params: {
  templateCode: string
  channel?: 'email' | 'telegram' | 'whatsapp' | 'sms' | 'internal'
  audience?: 'family' | 'staff' | 'partner' | 'system'
  leadId?: string | null
  dealId?: string | null
  applicationId?: string | null
  partnerAccountId?: string | null
  recipientName?: string | null
  recipientEmail?: string | null
  recipientPhone?: string | null
  payload?: TemplatePayload
  sendAfter?: string | null
  subjectOverride?: string | null
  bodyOverride?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data: template, error: templateError } = await admin
    .from('message_templates')
    .select('code, channel, audience, subject_template, body_template')
    .eq('code', params.templateCode)
    .eq('is_active', true)
    .maybeSingle()

  if (templateError || !template) {
    throw new Error(templateError?.message ?? `message_template_not_found:${params.templateCode}`)
  }

  const payload = params.payload ?? {}
  const subject = params.subjectOverride ?? renderTemplate(template.subject_template, payload)
  const body = params.bodyOverride ?? renderTemplate(template.body_template, payload)

  const { data, error } = await admin
    .from('message_outbox')
    .insert({
      lead_id: params.leadId ?? null,
      deal_id: params.dealId ?? null,
      application_id: params.applicationId ?? null,
      partner_account_id: params.partnerAccountId ?? null,
      channel: params.channel ?? template.channel,
      audience: params.audience ?? template.audience,
      template_code: template.code,
      recipient_name: params.recipientName ?? null,
      recipient_email: params.recipientEmail ?? null,
      recipient_phone: params.recipientPhone ?? null,
      subject: subject || null,
      body,
      send_after: params.sendAfter ?? new Date().toISOString(),
      metadata: {
        ...(params.metadata ?? {}),
        payload,
      },
    })
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data?.id ?? null
}
