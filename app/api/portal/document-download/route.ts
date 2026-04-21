import { z } from 'zod'
import { NextResponse } from 'next/server'
import { getPortalDocumentsBucket, hasServiceRole } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPortalTokenAccess } from '@/lib/portal-auth'

const schema = z.object({
  token: z.string().uuid(),
  document_id: z.string().uuid(),
})

export async function GET(request: Request) {
  if (!hasServiceRole()) {
    return NextResponse.json({ ok: false, error: 'service_role_missing' }, { status: 500 })
  }

  const url = new URL(request.url)
  const parsed = schema.safeParse({
    token: url.searchParams.get('token'),
    document_id: url.searchParams.get('document_id'),
  })

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
    .select('id, application_id, file_path')
    .eq('id', parsed.data.document_id)
    .eq('application_id', access.application.id)
    .maybeSingle()

  if (!document?.file_path) {
    return NextResponse.json({ ok: false, error: 'file_not_found' }, { status: 404 })
  }

  const bucket = getPortalDocumentsBucket()
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(document.file_path, 60 * 15)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: error?.message || 'signed_url_failed' }, { status: 400 })
  }

  return NextResponse.redirect(data.signedUrl)
}
