import { getExolveApiKey, getExolveCallbackResourceId, getExolveManagerPhone, getExolveNumberCode } from '@/lib/env'

export type ExolveCallbackParams = {
  clientPhone: string
  managerPhone?: string | null
  requestId?: string | null
}

export type ExolveCallbackResult = {
  ok: boolean
  providerCallId?: string | null
  providerCallSid?: string | null
  error?: string | null
  payload?: unknown
}

function onlyDigits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D+/g, '')
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readProviderCallId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const row = payload as Record<string, unknown>
  return readString(row.call_id)
    ?? readString(row.callId)
    ?? readString(row.call_sid)
    ?? readString(row.callSid)
    ?? readString(row.id)
    ?? readString(row.request_id)
}

function readProviderCallSid(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const row = payload as Record<string, unknown>
  return readString(row.call_sid) ?? readString(row.callSid) ?? null
}

export function normalizeExolvePhone(value: string | null | undefined) {
  const digits = onlyDigits(value)
  return digits || null
}

export function getExolveConfigState() {
  return {
    hasApiKey: Boolean(getExolveApiKey()),
    hasNumberCode: Boolean(getExolveNumberCode()),
    hasResourceId: Boolean(getExolveCallbackResourceId()),
    hasManagerPhone: Boolean(getExolveManagerPhone()),
  }
}

export async function requestExolveCallback(params: ExolveCallbackParams): Promise<ExolveCallbackResult> {
  const apiKey = getExolveApiKey()
  const numberCode = getExolveNumberCode()
  const resourceId = getExolveCallbackResourceId()
  const managerPhone = normalizeExolvePhone(params.managerPhone) ?? getExolveManagerPhone()
  const clientPhone = normalizeExolvePhone(params.clientPhone)

  if (!apiKey || !numberCode || !resourceId || !managerPhone || !clientPhone) {
    return {
      ok: false,
      error: 'exolve_not_configured',
      payload: { hasApiKey: Boolean(apiKey), hasNumberCode: Boolean(numberCode), hasResourceId: Boolean(resourceId), hasManagerPhone: Boolean(managerPhone), hasClientPhone: Boolean(clientPhone) },
    }
  }

  const body = {
    request_description: params.requestId ?? undefined,
    number_code: numberCode,
    callback_resource_id: resourceId,
    line_1: {
      destinations: [
        {
          number: managerPhone,
          timeout: 30,
        },
      ],
      display_number: numberCode,
    },
    line_2: {
      destinations: [
        {
          number: clientPhone,
          timeout: 30,
        },
      ],
      display_number: numberCode,
    },
  }

  const response = await fetch('https://api.exolve.ru/call/v1/MakeCallback', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = await response.text()
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `exolve_callback_failed_${response.status}`,
      payload,
    }
  }

  return {
    ok: true,
    providerCallId: readProviderCallId(payload),
    providerCallSid: readProviderCallSid(payload),
    payload,
  }
}
