import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const allowedSources = new Set(['website', 'telegram', 'landing', 'partner', 'referral', 'manual'])

function normalizeSourceChannel(value?: string) {
  if (!value) return 'manual'
  return allowedSources.has(value) ? value : 'manual'
}

function normalizePhone(value?: string | null) {
  return (value ?? '').replace(/\D+/g, '') || null
}

function normalizeEmail(value?: string | null) {
  const email = (value ?? '').trim().toLowerCase()
  return email || null
}

function renderTemplate(template: string | null | undefined, payload: Record<string, string | null | undefined>) {
  let output = template ?? ''
  for (const [key, value] of Object.entries(payload)) {
    output = output.replaceAll(`{{${key}}}`, value ?? '')
  }
  return output.replace(/\{\{[^}]+\}\}/g, '—')
}

async function resolvePartnerCode(supabase: ReturnType<typeof createClient>, rawCode?: string | null) {
  const code = (rawCode ?? '').trim().toLowerCase()
  if (!code) return null

  const { data } = await supabase
    .from('partner_referral_codes')
    .select('id, partner_account_id, code, label, lock_days, status, partner:accounts(display_name)')
    .eq('code', code)
    .eq('status', 'active')
    .maybeSingle()

  if (!data) return null

  const { data: account } = await supabase
    .from('accounts')
    .select('id, display_name')
    .eq('id', data.partner_account_id)
    .maybeSingle()

  return {
    code: data.code,
    label: data.label,
    lock_days: data.lock_days ?? 180,
    partner_account_id: data.partner_account_id,
    partner_name: account?.display_name ?? ((data.partner as { display_name?: string | null } | null)?.display_name ?? 'Партнёр'),
  }
}

async function queuePartnerLeadMessage(supabase: ReturnType<typeof createClient>, params: {
  leadId: string
  partnerAccountId: string
  partnerName: string
  partnerLabel?: string | null
  contactNameRaw?: string | null
  desiredCountry?: string | null
}) {
  const { data: template } = await supabase
    .from('message_templates')
    .select('code, channel, audience, subject_template, body_template')
    .eq('code', 'partner_lead_registered')
    .eq('is_active', true)
    .maybeSingle()

  if (!template) return

  const { data: partnerContact } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, is_primary')
    .eq('account_id', params.partnerAccountId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!partnerContact?.email && !partnerContact?.phone) return

  const payload = {
    partner_name: params.partnerName,
    lead_name: params.contactNameRaw ?? 'Новый лид',
    desired_country: params.desiredCountry ?? '—',
    partner_label: params.partnerLabel ?? '—',
  }

  await supabase.from('message_outbox').insert({
    lead_id: params.leadId,
    partner_account_id: params.partnerAccountId,
    channel: template.channel,
    audience: template.audience,
    template_code: template.code,
    recipient_name: [partnerContact.first_name, partnerContact.last_name].filter(Boolean).join(' ') || params.partnerName,
    recipient_email: partnerContact.email ?? null,
    recipient_phone: partnerContact.phone ?? null,
    subject: renderTemplate(template.subject_template, payload) || null,
    body: renderTemplate(template.body_template, payload),
    status: 'queued',
    send_after: new Date().toISOString(),
    metadata: {
      source: 'supabase_function_intake_webhook',
      payload,
    },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const payload = await req.json()
    const programSlug = String(payload.program_slug ?? '') || null
    const partner = await resolvePartnerCode(supabase, payload.partner_code)

    let programId: string | null = null
    if (programSlug) {
      const { data } = await supabase.from('programs').select('id').eq('public_slug', programSlug).maybeSingle()
      programId = data?.id ?? null
    }

    const normalizedPhone = normalizePhone(payload.phone_raw)
    const normalizedEmail = normalizeEmail(payload.email_raw)
    let duplicateLeadId: string | null = null

    if (normalizedPhone || normalizedEmail) {
      let query = supabase.from('leads').select('id').order('created_at', { ascending: false }).limit(1)
      if (normalizedPhone && normalizedEmail) query = query.or(`normalized_phone.eq.${normalizedPhone},normalized_email.eq.${normalizedEmail}`)
      else if (normalizedPhone) query = query.eq('normalized_phone', normalizedPhone)
      else if (normalizedEmail) query = query.eq('normalized_email', normalizedEmail)
      const { data } = await query.maybeSingle()
      duplicateLeadId = data?.id ?? null
    }

    const ownershipLockedUntil = partner ? new Date(Date.now() + Number(partner.lock_days ?? 180) * 24 * 60 * 60 * 1000).toISOString() : null
    const sourceChannel = partner ? 'partner' : normalizeSourceChannel(payload.source_channel)

    const { data: inserted, error } = await supabase
      .from('leads')
      .insert({
        desired_program_id: programId,
        desired_departure_id: payload.desired_departure_id ?? null,
        source_channel: sourceChannel,
        source_detail: payload.source_detail ?? 'intake-webhook',
        contact_name_raw: payload.contact_name_raw ?? null,
        phone_raw: payload.phone_raw ?? null,
        email_raw: payload.email_raw ?? null,
        desired_country: payload.desired_country ?? null,
        status: duplicateLeadId ? 'duplicate' : 'new',
        message: payload.message ?? null,
        partner_account_id: partner?.partner_account_id ?? null,
        ownership_lock_status: partner ? 'partner_owned' : null,
        ownership_locked_until: ownershipLockedUntil,
        ownership_note: partner ? `Lead пришёл по партнёрскому коду ${partner.code}` : null,
        metadata: {
          duplicate_of_lead_id: duplicateLeadId,
          intake_origin: 'supabase_function_intake_webhook',
          partner_code: partner?.code ?? null,
          raw_payload: payload,
        },
      })
      .select('id, status')
      .maybeSingle()

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (inserted?.id && partner) {
      await queuePartnerLeadMessage(supabase, {
        leadId: inserted.id,
        partnerAccountId: partner.partner_account_id,
        partnerName: partner.partner_name,
        partnerLabel: partner.label,
        contactNameRaw: payload.contact_name_raw ?? null,
        desiredCountry: payload.desired_country ?? null,
      })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        lead_id: inserted?.id ?? null,
        status: inserted?.status ?? 'new',
        partner_code: partner?.code ?? null,
        partner_account_id: partner?.partner_account_id ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
