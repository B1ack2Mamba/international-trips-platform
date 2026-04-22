import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { getMessageInboundWebhookSecret } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const channels = ['email', 'telegram', 'whatsapp', 'sms', 'internal'] as const

const schema = z.object({
  lead_id: z.string().uuid().optional().or(z.literal('')),
  deal_id: z.string().uuid().optional().or(z.literal('')),
  application_id: z.string().uuid().optional().or(z.literal('')),
  partner_account_id: z.string().uuid().optional().or(z.literal('')),
  channel: z.enum(channels).default('email'),
  sender_name: z.string().optional().or(z.literal('')),
  sender_email: z.string().email().optional().or(z.literal('')),
  sender_phone: z.string().optional().or(z.literal('')),
  subject: z.string().optional().or(z.literal('')),
  body: z.string().min(1),
  provider: z.string().optional().or(z.literal('')),
  external_message_id: z.string().optional().or(z.literal('')),
  received_at: z.string().datetime().optional().or(z.literal('')),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

function normalizeEmail(value?: string | null) {
  return (value ?? '').trim().toLowerCase() || null
}

function normalizePhone(value?: string | null) {
  return (value ?? '').replace(/\D+/g, '') || null
}

function optionalValue(value?: string | null) {
  return value?.trim() || null
}

function isAuthorized(request: NextRequest) {
  const secret = getMessageInboundWebhookSecret()
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function findLeadId(input: z.infer<typeof schema>) {
  if (input.lead_id) return input.lead_id

  const email = normalizeEmail(input.sender_email)
  const phone = normalizePhone(input.sender_phone)
  if (!email && !phone) return null

  const admin = createAdminClient()
  let query = admin.from('leads').select('id').order('created_at', { ascending: false }).limit(1)

  if (email && phone) {
    query = query.or(`normalized_email.eq.${email},normalized_phone.eq.${phone}`)
  } else if (email) {
    query = query.eq('normalized_email', email)
  } else if (phone) {
    query = query.eq('normalized_phone', phone)
  }

  const { data } = await query.maybeSingle<{ id: string }>()
  return data?.id ?? null
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 })
  }

  const input = parsed.data
  const leadId = await findLeadId(input)
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('message_inbox')
    .insert({
      lead_id: leadId,
      deal_id: optionalValue(input.deal_id),
      application_id: optionalValue(input.application_id),
      partner_account_id: optionalValue(input.partner_account_id),
      channel: input.channel,
      audience: 'family',
      sender_name: optionalValue(input.sender_name),
      sender_email: normalizeEmail(input.sender_email),
      sender_phone: optionalValue(input.sender_phone),
      subject: optionalValue(input.subject),
      body: input.body,
      provider: optionalValue(input.provider) ?? 'webhook',
      external_message_id: optionalValue(input.external_message_id),
      received_at: input.received_at || new Date().toISOString(),
      metadata: {
        ...(input.metadata ?? {}),
        source: 'api_inbound_message',
        matched_lead_id: leadId,
      },
    })
    .select('id, lead_id')
    .maybeSingle<{ id: string; lead_id: string | null }>()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  if (data?.lead_id) {
    await admin.from('activity_log').insert({
      actor_user_id: null,
      entity_type: 'lead',
      entity_id: data.lead_id,
      event_type: 'lead_inbound_message_received',
      title: 'Получено входящее сообщение',
      body: input.subject ? `${input.subject}\n\n${input.body}` : input.body,
      metadata: {
        channel: input.channel,
        provider: optionalValue(input.provider) ?? 'webhook',
        message_inbox_id: data.id,
      },
    })
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null, lead_id: data?.lead_id ?? null })
}
