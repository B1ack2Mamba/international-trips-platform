import { NextRequest, NextResponse } from 'next/server'
import { getExolveWebhookToken } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EventStatus = 'initiated' | 'ringing' | 'answered' | 'missed' | 'completed' | 'failed' | 'recording_ready' | 'transcription_ready' | 'speech_analytics_ready'

function normalizePhone(value: unknown) {
  return String(value ?? '').replace(/\D+/g, '') || null
}

function readString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function readNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function readIsoDate(row: Record<string, unknown>, keys: string[]) {
  const raw = readString(row, keys)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function eventToStatus(eventType: string | null): EventStatus {
  if (eventType === 's') return 'answered'
  if (eventType === 'h' || eventType === 'e') return 'completed'
  if (eventType === 'd') return 'missed'
  if (eventType === 'crr') return 'recording_ready'
  if (eventType === 'trc') return 'transcription_ready'
  if (eventType === 'sar') return 'speech_analytics_ready'
  if (eventType === 'b' || eventType === 'o') return 'ringing'
  return 'initiated'
}

function normalizeDurationSeconds(value: number | null) {
  if (value === null) return null
  return value > 3600 ? Math.round(value / 1000) : Math.round(value)
}

function isAuthorized(request: NextRequest) {
  const token = getExolveWebhookToken()
  if (!token) return true
  const bearer = request.headers.get('authorization') === `Bearer ${token}`
  const queryToken = request.nextUrl.searchParams.get('token') === token
  const headerToken = request.headers.get('x-exolve-token') === token
  return bearer || queryToken || headerToken
}

async function findLeadByPhone(phone: string | null) {
  if (!phone) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('leads')
    .select('id, owner_user_id, contact_name_raw')
    .eq('normalized_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; owner_user_id: string | null; contact_name_raw: string | null }>()

  return data ?? null
}

async function createMissedCallTask(leadId: string, ownerUserId: string | null, callLogId: string, phone: string | null) {
  const admin = createAdminClient()
  await admin.from('tasks').insert({
    owner_user_id: ownerUserId,
    lead_id: leadId,
    title: 'Перезвонить по пропущенному звонку',
    description: phone ? `Клиент звонил с номера +${phone}.` : 'Клиент звонил, звонок пропущен.',
    status: 'todo',
    priority: 'high',
    due_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    metadata: {
      automation_key: 'missed_exolve_call',
      provider: 'exolve',
      call_log_id: callLogId,
    },
  })
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const row = payload as Record<string, unknown>
  const eventType = readString(row, ['event_type', 'eventType', 'event', 'type'])
  const status = eventToStatus(eventType)
  const providerDirection = readString(row, ['direction'])
  const providerCallId = readString(row, ['call_id', 'callId', 'uid', 'id', 'client_id', 'request_id', 'requestId'])
  const providerCallSid = readString(row, ['call_sid', 'callSid', 'sid'])
  const sourceNumber = normalizePhone(readString(row, ['from', 'caller', 'caller_number', 'calling_number', 'src', 'phone_a', 'number_a', 'source_number']))
  const destinationNumber = normalizePhone(readString(row, ['to', 'callee', 'called_number', 'redirect_number', 'number', 'dst', 'phone_b', 'number_b', 'destination_number']))
  const hasRedirectNumber = Boolean(readString(row, ['redirect_number']))
  const direction = providerDirection === 'outbound'
    ? 'outbound'
    : providerDirection === 'inbound' || eventType === 'b' || hasRedirectNumber
      ? 'inbound'
      : 'callback'
  const clientPhone = direction === 'inbound' ? (sourceNumber ?? destinationNumber) : (destinationNumber ?? sourceNumber)
  const lead = await findLeadByPhone(clientPhone)
  const now = new Date().toISOString()
  const startedAt = readIsoDate(row, ['started', 'start_time', 'started_at', 'date_time', 'timestamp', 'created_at']) ?? now
  const answeredAt = status === 'answered' ? (readIsoDate(row, ['answer_time', 'answered_at', 'date_time', 'timestamp']) ?? now) : null
  const endedAt = ['missed', 'completed'].includes(status) ? (readIsoDate(row, ['ended', 'end_time', 'ended_at', 'date_time', 'timestamp']) ?? now) : null
  const durationSeconds = normalizeDurationSeconds(readNumber(row, ['duration', 'duration_seconds', 'billsec', 'call_duration']))
  const recordingUrl = readString(row, ['record_url', 'recording_url', 'recordingUrl', 'url'])
  const recordingDuration = readNumber(row, ['recording_duration', 'recording_duration_seconds'])
  const admin = createAdminClient()

  const baseCallLog = {
    lead_id: lead?.id ?? null,
    owner_user_id: lead?.owner_user_id ?? null,
    provider: 'exolve',
    provider_call_id: providerCallId,
    provider_call_sid: providerCallSid,
    direction,
    status,
    source_number: sourceNumber,
    destination_number: destinationNumber,
    display_number: clientPhone,
    started_at: startedAt,
    answered_at: answeredAt,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    recording_url: recordingUrl,
    recording_duration_seconds: recordingDuration,
    metadata: {
      source: 'exolve_webhook',
      event_type: eventType,
      raw: row,
    },
  }

  let callLogId: string | null = null

  if (providerCallId) {
    const { data: existing } = await admin
      .from('call_logs')
      .select('id')
      .eq('provider', 'exolve')
      .eq('provider_call_id', providerCallId)
      .maybeSingle<{ id: string }>()

    if (existing?.id) {
      const { data, error } = await admin
        .from('call_logs')
        .update(baseCallLog)
        .eq('id', existing.id)
        .select('id')
        .maybeSingle<{ id: string }>()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      callLogId = data?.id ?? existing.id
    } else {
      const { data, error } = await admin.from('call_logs').insert(baseCallLog).select('id').maybeSingle<{ id: string }>()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      callLogId = data?.id ?? null
    }
  } else {
    const { data, error } = await admin.from('call_logs').insert(baseCallLog).select('id').maybeSingle<{ id: string }>()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    callLogId = data?.id ?? null
  }

  if (lead?.id && callLogId) {
    await admin.from('activity_log').insert({
      actor_user_id: null,
      entity_type: 'lead',
      entity_id: lead.id,
      event_type: status === 'missed' ? 'lead_call_missed' : 'lead_call_event',
      title: status === 'missed' ? 'Пропущенный звонок' : 'Событие звонка Exolve',
      body: clientPhone ? `Телефон: +${clientPhone}` : 'Звонок получен через Exolve.',
      metadata: { provider: 'exolve', call_log_id: callLogId, status, event_type: eventType },
    })

    if (status === 'missed') {
      await createMissedCallTask(lead.id, lead.owner_user_id, callLogId, clientPhone)
    }
  }

  return NextResponse.json({ ok: true, id: callLogId, lead_id: lead?.id ?? null, status })
}
