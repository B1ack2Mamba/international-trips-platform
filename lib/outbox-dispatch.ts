import { createAdminClient } from '@/lib/supabase/admin'
import {
  getMessageDispatchBatchSize,
  getMessageDispatchWebhookSecret,
  getMessageDispatchWebhookUrl,
  isMessageDispatchDryRun,
} from '@/lib/env'

type OutboxRow = {
  id: string
  lead_id: string | null
  deal_id: string | null
  application_id: string | null
  partner_account_id: string | null
  channel: 'email' | 'telegram' | 'whatsapp' | 'sms' | 'internal'
  audience: 'family' | 'staff' | 'partner' | 'system'
  template_code: string | null
  recipient_name: string | null
  recipient_email: string | null
  recipient_phone: string | null
  subject: string | null
  body: string
  status: 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled'
  provider: string | null
  send_after: string
  sent_at: string | null
  last_error: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type DispatchOutcome = {
  provider: string
  providerMessageId?: string | null
  responseSummary?: string | null
}

function truncateError(value: string, maxLength = 500) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function getRecipientSummary(message: OutboxRow) {
  return {
    name: message.recipient_name,
    email: message.recipient_email,
    phone: message.recipient_phone,
  }
}

function ensureMessageHasRequiredRecipient(message: OutboxRow) {
  if (message.channel === 'email' && !message.recipient_email) {
    throw new Error('recipient_email_missing')
  }

  if ((message.channel === 'sms' || message.channel === 'whatsapp') && !message.recipient_phone) {
    throw new Error('recipient_phone_missing')
  }
}

async function claimQueuedMessage(messageId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('message_outbox')
    .update({
      status: 'processing',
      last_error: null,
    })
    .eq('id', messageId)
    .eq('status', 'queued')
    .select(
      'id, lead_id, deal_id, application_id, partner_account_id, channel, audience, template_code, recipient_name, recipient_email, recipient_phone, subject, body, status, provider, send_after, sent_at, last_error, metadata, created_at',
    )
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as OutboxRow | null) ?? null
}

async function markMessageSent(message: OutboxRow, outcome: DispatchOutcome) {
  const admin = createAdminClient()
  const metadata = {
    ...(message.metadata ?? {}),
    delivery: {
      provider: outcome.provider,
      provider_message_id: outcome.providerMessageId ?? null,
      response_summary: outcome.responseSummary ?? null,
      dispatched_at: new Date().toISOString(),
    },
  }

  const { error } = await admin
    .from('message_outbox')
    .update({
      status: 'sent',
      provider: outcome.provider,
      sent_at: new Date().toISOString(),
      last_error: null,
      metadata,
    })
    .eq('id', message.id)

  if (error) throw new Error(error.message)
}

async function markMessageFailed(message: OutboxRow, errorMessage: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('message_outbox')
    .update({
      status: 'failed',
      last_error: truncateError(errorMessage),
    })
    .eq('id', message.id)

  if (error) throw new Error(error.message)
}

async function deliverViaWebhook(message: OutboxRow, webhookUrl: string, secret?: string | null): Promise<DispatchOutcome> {
  ensureMessageHasRequiredRecipient(message)

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      'X-Message-Outbox-Id': message.id,
    },
    body: JSON.stringify({
      event: 'message_outbox.dispatch',
      message: {
        id: message.id,
        channel: message.channel,
        audience: message.audience,
        template_code: message.template_code,
        subject: message.subject,
        body: message.body,
        send_after: message.send_after,
        created_at: message.created_at,
      },
      recipient: getRecipientSummary(message),
      links: {
        lead_id: message.lead_id,
        deal_id: message.deal_id,
        application_id: message.application_id,
        partner_account_id: message.partner_account_id,
      },
      metadata: message.metadata ?? {},
    }),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`webhook_http_${response.status}:${truncateError(text, 250)}`)
  }

  let payload: Record<string, unknown> | null = null
  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : null
  } catch {
    payload = null
  }

  return {
    provider: 'webhook',
    providerMessageId: typeof payload?.message_id === 'string' ? payload.message_id : null,
    responseSummary: text ? truncateError(text, 250) : null,
  }
}

async function deliverMessage(message: OutboxRow): Promise<DispatchOutcome> {
  if (message.channel === 'internal') {
    return {
      provider: 'internal',
      responseSummary: 'internal_message_marked_sent',
    }
  }

  const webhookUrl = getMessageDispatchWebhookUrl()
  const webhookSecret = getMessageDispatchWebhookSecret()
  const dryRun = isMessageDispatchDryRun()

  if (webhookUrl) {
    return deliverViaWebhook(message, webhookUrl, webhookSecret)
  }

  if (dryRun) {
    ensureMessageHasRequiredRecipient(message)
    return {
      provider: 'dry_run',
      responseSummary: 'dispatcher_dry_run',
    }
  }

  throw new Error(`dispatcher_not_configured_for_${message.channel}`)
}

export async function dispatchOutboxBatch(params?: {
  limit?: number
  requestSource?: 'dashboard_manual' | 'vercel_cron' | 'local_script' | 'api'
}) {
  const admin = createAdminClient()
  const limit = params?.limit && Number.isFinite(params.limit) ? Math.max(1, Math.min(params.limit, 100)) : getMessageDispatchBatchSize()

  const { data, error } = await admin
    .from('message_outbox')
    .select(
      'id, lead_id, deal_id, application_id, partner_account_id, channel, audience, template_code, recipient_name, recipient_email, recipient_phone, subject, body, status, provider, send_after, sent_at, last_error, metadata, created_at',
    )
    .eq('status', 'queued')
    .lte('send_after', new Date().toISOString())
    .order('send_after', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  const queued = (data as OutboxRow[] | null) ?? []
  const result = {
    requestSource: params?.requestSource ?? 'api',
    selected: queued.length,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    items: [] as Array<{
      id: string
      status: 'sent' | 'failed' | 'skipped'
      provider?: string
      error?: string
    }>,
  }

  for (const candidate of queued) {
    const claimed = await claimQueuedMessage(candidate.id)
    if (!claimed) {
      result.skipped += 1
      result.items.push({ id: candidate.id, status: 'skipped', error: 'already_claimed' })
      continue
    }

    try {
      const outcome = await deliverMessage(claimed)
      await markMessageSent(claimed, outcome)
      result.processed += 1
      result.sent += 1
      result.items.push({ id: claimed.id, status: 'sent', provider: outcome.provider })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await markMessageFailed(claimed, message)
      result.processed += 1
      result.failed += 1
      result.items.push({ id: claimed.id, status: 'failed', error: truncateError(message, 250) })
    }
  }

  return result
}
