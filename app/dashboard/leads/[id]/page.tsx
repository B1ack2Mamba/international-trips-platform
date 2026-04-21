import { notFound, redirect } from 'next/navigation'
import { getLeadById } from '@/lib/queries'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lead = await getLeadById(id)
  if (!lead) notFound()

  if (lead.converted_deal_id) {
    redirect(`/dashboard/deals?open=${encodeURIComponent(lead.converted_deal_id)}#deal-editor`)
  }

  redirect(lead.owner_user_id ? `/dashboard/my-leads?open=${encodeURIComponent(id)}` : `/dashboard/leads?open=${encodeURIComponent(id)}`)
}
