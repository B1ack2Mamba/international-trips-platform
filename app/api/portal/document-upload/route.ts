import { z } from 'zod'
import { NextResponse } from 'next/server'
import { getPortalDocumentsBucket, hasServiceRole } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPortalTokenAccess } from '@/lib/portal-auth'

const schema = z.object({
  token: z.string().uuid(),
  document_id: z.string().uuid(),
  filename: z.string().min(3),
})

function sanitizeFilename(filename: string) {
  return filename.trim().toLowerCase().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '')
}

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
    .select('id, application_id, code')
    .eq('id', parsed.data.document_id)
    .eq('application_id', access.application.id)
    .maybeSingle()
  if (!document) {
    return NextResponse.json({ ok: false, error: 'document_not_found' }, { status: 404 })
  }

  const safeFilename = sanitizeFilename(parsed.data.filename) || 'document.bin'
  const path = `applications/${access.application.id}/${document.id}-${document.code}/${Date.now()}-${safeFilename}`
  const bucket = getPortalDocumentsBucket()
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path)
  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || 'signed_upload_url_failed' }, { status: 400 })
  }

  await admin.from('application_documents').update({ file_path: path }).eq('id', document.id)
  return NextResponse.json({ ok: true, bucket, path, token: data.token, signedUrlPath: data.path })
}
