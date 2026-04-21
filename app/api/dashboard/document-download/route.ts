import { z } from 'zod'
import { NextResponse } from 'next/server'
import { hasServiceRole, getPortalDocumentsBucket } from '@/lib/env'
import { isStaffRole } from '@/lib/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  document_id: z.string().uuid(),
})

export async function GET(request: Request) {
  if (!hasServiceRole()) {
    return NextResponse.json({ ok: false, error: 'service_role_missing' }, { status: 500 })
  }

  const url = new URL(request.url)
  const parsed = schema.safeParse({
    document_id: url.searchParams.get('document_id'),
  })

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'validation_failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (!profile?.is_active || !isStaffRole(profile.role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: document } = await admin
    .from('application_documents')
    .select('id, file_path')
    .eq('id', parsed.data.document_id)
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
