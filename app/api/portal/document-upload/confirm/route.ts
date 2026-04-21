import { z } from 'zod'
import { NextResponse } from 'next/server'
import { hasServiceRole } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPortalTokenAccess } from '@/lib/portal-auth'

const schema = z.object({
  token: z.string().uuid(),
  document_id: z.string().uuid(),
  path: z.string().min(3),
})

export async function POST(request: Request) {
  if (!hasServiceRole()) {
    return NextResponse.json({ ok: false, error: 'service_role_missing' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'validation_failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const access = await hasPortalTokenAccess(parsed.data.token)
  if (!access.ok || !access.application) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.error === 'otp_required' ? 401 : 403 })
  }

  const admin = createAdminClient()
  const { data: document } = await admin
    .from('application_documents')
    .select('id, application_id')
    .eq('id', parsed.data.document_id)
    .eq('application_id', access.application.id)
    .maybeSingle()
  if (!document) {
    return NextResponse.json({ ok: false, error: 'document_not_found' }, { status: 404 })
  }

  await admin
    .from('application_documents')
    .update({
      status: 'uploaded',
      file_path: parsed.data.path,
      notes: 'Файл загружен из кабинета семьи и ожидает проверки менеджером.',
    })
    .eq('id', document.id)
  await admin.from('activity_log').insert([
    { entity_type: 'document', entity_id: document.id, event_type: 'portal_document_uploaded', title: 'Семья загрузила документ', body: parsed.data.path, metadata: { source: 'portal', application_id: access.application.id } },
    { entity_type: 'application', entity_id: access.application.id, event_type: 'portal_document_uploaded', title: 'В кабинет семьи загружен документ', body: parsed.data.path, metadata: { source: 'portal', document_id: document.id } },
  ])
  return NextResponse.json({ ok: true })
}
