import { NextRequest, NextResponse } from 'next/server'
import { getCronSecret, getMessageDispatchBatchSize } from '@/lib/env'
import { dispatchOutboxBatch } from '@/lib/outbox-dispatch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest) {
  const cronSecret = getCronSecret()
  if (!cronSecret) {
    return true
  }

  const authorization = request.headers.get('authorization')
  return authorization === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const rawLimit = Number(request.nextUrl.searchParams.get('limit') ?? getMessageDispatchBatchSize())
  const limit = Number.isFinite(rawLimit) ? rawLimit : getMessageDispatchBatchSize()

  try {
    const result = await dispatchOutboxBatch({
      limit,
      requestSource: 'vercel_cron',
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
