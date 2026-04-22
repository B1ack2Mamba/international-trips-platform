import { hasServiceRole } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type JsonMap = Record<string, unknown> | null


function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asRow<T>(value: unknown): T | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return (value[0] ?? null) as T | null
  return (value ?? null) as T | null
}

function normalizeLeadRow(row: LeadRow): LeadRow {
  return {
    ...row,
    owner: firstRelation(row.owner),
    partner: firstRelation(row.partner),
    desired_program: firstRelation(row.desired_program),
    desired_departure: firstRelation(row.desired_departure),
  }
}

function normalizeDealRow(row: DealRow): DealRow {
  return {
    ...row,
    owner: firstRelation(row.owner),
    lead: firstRelation(row.lead),
    account: firstRelation(row.account),
    partner: firstRelation(row.partner),
    program: firstRelation(row.program),
    departure: firstRelation(row.departure),
  }
}

function normalizeApplicationRow(row: ApplicationRow): ApplicationRow {
  return {
    ...row,
    visa_status: row.visa_status ?? 'not_started',
    contract_status: row.contract_status ?? 'draft',
    payment_status: row.payment_status ?? 'pending',
    deal: firstRelation(row.deal),
    departure: firstRelation(row.departure),
  }
}

function normalizeApplicationDetailRow(row: ApplicationDetailRow): ApplicationDetailRow {
  const deal = firstRelation(row.deal)
  const departure = firstRelation(row.departure)

  return {
    ...row,
    deal: deal
      ? {
          ...deal,
          account: firstRelation(deal.account),
          program: firstRelation(deal.program),
          departure: firstRelation(deal.departure),
        }
      : null,
    departure: departure
      ? {
          ...departure,
          program: firstRelation(departure.program),
        }
      : null,
  }
}


function normalizeDepartureRow(row: DepartureRow): DepartureRow {
  return {
    ...row,
    program: firstRelation(row.program),
  }
}

function normalizePaymentRow(row: PaymentRow): PaymentRow {
  const metadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : null) as JsonMap
  const rawPaid = metadata && typeof metadata['paid_amount'] === 'number'
    ? Number(metadata['paid_amount'])
    : metadata && typeof metadata['paid_amount'] === 'string'
      ? Number(metadata['paid_amount'])
      : 0
  const safePaid = Number.isFinite(rawPaid) ? Math.max(0, rawPaid) : 0
  return {
    ...row,
    metadata,
    paid_amount: safePaid,
    application: firstRelation(row.application),
    deal: firstRelation(row.deal),
  }
}

function normalizeContractRow(row: ContractRow): ContractRow {
  return {
    ...row,
    application: firstRelation(row.application),
    deal: firstRelation(row.deal),
    account: firstRelation(row.account),
    template: firstRelation(row.template),
  }
}


export type ManagerOption = {
  id: string
  full_name: string | null
  email: string | null
  role?: string | null
}

export type MiniProfile = {
  id: string
  full_name: string | null
  email: string | null
} | null

export type MiniProgram = {
  id: string
  title: string
  public_slug: string | null
  segment?: string | null
} | null

export type MiniDeparture = {
  id: string
  departure_name: string
  start_date: string | null
  status?: string | null
} | null

export type LeadRow = {
  id: string
  owner_user_id: string | null
  desired_program_id: string | null
  desired_departure_id: string | null
  converted_deal_id: string | null
  partner_account_id?: string | null
  ownership_lock_status?: string | null
  ownership_locked_until?: string | null
  ownership_note?: string | null
  source_channel: string
  source_detail: string | null
  contact_name_raw: string | null
  phone_raw: string | null
  email_raw: string | null
  desired_country: string | null
  status: string
  score: number | null
  message: string | null
  metadata: JsonMap
  assigned_at: string | null
  qualified_at: string | null
  next_action_at: string | null
  disqualified_reason: string | null
  created_at: string
  owner?: MiniProfile
  partner?: { id: string; display_name: string; account_type: string } | null
  desired_program?: MiniProgram
  desired_departure?: MiniDeparture
}

export type DealRow = {
  id: string
  owner_user_id: string | null
  lead_id: string | null
  account_id: string | null
  program_id: string | null
  departure_id: string | null
  partner_account_id?: string | null
  ownership_lock_status?: string | null
  ownership_locked_until?: string | null
  ownership_note?: string | null
  title: string
  stage: string
  estimated_value: number | null
  currency: string
  participants_count: number
  close_date: string | null
  notes: string | null
  created_at: string
  owner?: MiniProfile
  lead?: { id: string; contact_name_raw: string | null; phone_raw: string | null; email_raw: string | null; desired_country?: string | null; source_channel?: string | null; message?: string | null; desired_program?: MiniProgram | null; desired_departure?: MiniDeparture | null } | null
  account?: { id: string; display_name: string; account_type: string } | null
  partner?: { id: string; display_name: string; account_type: string } | null
  program?: MiniProgram
  departure?: MiniDeparture
}

export type DealFlowSummary = {
  deal_id: string
  contract_id: string | null
  contract_status: string | null
  contract_signed_at: string | null
  payment_id: string | null
  payment_status: string | null
  payment_amount: number
  payment_paid_amount: number
  application_id: string | null
}

export type AccountRow = {
  id: string
  display_name: string
  account_type: string
  city: string | null
  country: string | null
  status: string
  created_at: string
}

export type ProgramRow = {
  id: string
  code?: string
  title: string
  country: string
  city: string | null
  segment: string
  trip_type: string
  language: string | null
  duration_days: number
  short_description?: string | null
  description?: string | null
  public_slug: string
  is_active?: boolean
}

export type DepartureRow = {
  id: string
  departure_name: string
  city: string | null
  start_date: string
  end_date: string
  application_deadline: string | null
  seat_capacity: number
  status: string
  base_price: number
  currency: string
  program_id?: string
  program?: {
    id: string
    title: string
    country: string | null
    city: string | null
    segment: string | null
    public_slug: string | null
  } | null
}


export type DepartureDetailRow = DepartureRow

export type ApplicationRow = {
  id: string
  deal_id: string | null
  departure_id: string | null
  participant_name: string
  guardian_name: string | null
  guardian_phone?: string | null
  guardian_email?: string | null
  status: string
  visa_status: string
  contract_status: string
  documents_ready: boolean
  amount_total: number
  amount_paid: number
  payment_status: string
  created_at: string
  deal?: { id: string; title: string; stage: string } | null
  departure?: MiniDeparture
}

export type ApplicationDetailRow = {
  id: string
  deal_id: string | null
  departure_id: string | null
  participant_name: string
  participant_birth_date: string | null
  guardian_name: string | null
  guardian_phone: string | null
  guardian_email: string | null
  status: string
  documents_ready: boolean
  documents_completion_pct: number
  visa_status: string | null
  amount_total: number
  amount_paid: number
  notes: string | null
  portal_access_token: string
  portal_access_enabled: boolean
  portal_auth_mode: 'link' | 'otp_required'
  portal_access_expires_at: string | null
  portal_last_opened_at: string | null
  current_contract_id: string | null
  created_at: string
  deal?: {
    id: string
    title: string
    stage: string
    currency: string
    account_id: string | null
    account?: { id: string; display_name: string; account_type: string } | null
    program?: MiniProgram
    departure?: MiniDeparture
  } | null
  departure?: {
    id: string
    departure_name: string
    start_date: string | null
    end_date: string | null
    city: string | null
    status: string | null
    currency?: string | null
    program?: {
      id: string
      title: string
      country: string | null
      city: string | null
      segment: string | null
      public_slug: string | null
    } | null
  } | null
}

export type PaymentRow = {
  id: string
  deal_id: string | null
  application_id: string | null
  payer_name: string
  label: string
  amount: number
  currency: string
  due_date: string | null
  status: string
  paid_at: string | null
  created_at: string
  metadata?: JsonMap
  paid_amount?: number
  application?: { id: string; participant_name: string } | null
  deal?: { id: string; title: string } | null
}

export type SalesScriptRow = {
  id: string
  segment: string
  stage: string
  title: string
  body: string
  created_at: string
}

export type TaskRow = {
  id: string
  owner_user_id?: string | null
  lead_id?: string | null
  deal_id?: string | null
  application_id?: string | null
  title: string
  description?: string | null
  status: string
  due_date: string | null
  priority: string
  created_at: string
  lead?: { id: string; contact_name_raw: string | null; phone_raw: string | null; email_raw: string | null } | null
  deal?: { id: string; title: string; stage: string | null } | null
  application?: { id: string; participant_name: string | null } | null
}

export type ActivityRow = {
  id: string
  entity_type: string
  entity_id: string
  event_type: string
  title: string
  body: string | null
  metadata: JsonMap
  created_at: string
  actor: MiniProfile
}

export type ApplicationDocumentRow = {
  id: string
  application_id: string
  code: string
  title: string
  status: string
  due_date: string | null
  file_path: string | null
  reviewed_at: string | null
  rejected_reason: string | null
  notes: string | null
  sort_order: number
  created_at: string
  reviewed_by?: MiniProfile
}

export type ContractTemplateRow = {
  id: string
  code: string
  title: string
  segment: string | null
  locale: string
  is_active: boolean
  created_at: string
}

export type ContractRow = {
  id: string
  application_id: string
  deal_id: string | null
  account_id: string | null
  contract_template_id: string | null
  contract_number: string
  title: string
  status: string
  locale: string
  payload: JsonMap
  rendered_text: string
  sent_at: string | null
  viewed_at: string | null
  signed_at: string | null
  signatory_name: string | null
  signatory_email: string | null
  notes: string | null
  created_at: string
  application?: { id: string; participant_name: string; guardian_name: string | null; guardian_email: string | null } | null
  deal?: { id: string; title: string } | null
  account?: { id: string; display_name: string; account_type: string } | null
  template?: { id: string; code: string; title: string } | null
}


export type ControllingExpenseRow = {
  id: string
  departure_id: string | null
  title: string
  category: string | null
  expense_kind: string
  expense_nature: string
  scope_type: string
  amount: number
  currency: string
  recognized_on: string
  status: string
  notes: string | null
  created_at: string
  created_by?: MiniProfile
  departure?: {
    id: string
    departure_name: string
    start_date: string | null
    program?: { id: string; title: string } | null
  } | null
}

export type ControllingSummaryRow = {
  paid_revenue: number
  cogs_total: number
  operating_expenses_total: number
  fixed_expenses_total: number
  variable_expenses_total: number
  gross_profit: number
  net_profit: number
}

export type DepartureProfitabilityRow = {
  departure_id: string
  departure_name: string
  start_date: string | null
  status: string | null
  applications_count: number
  paid_revenue: number
  cogs_total: number
  gross_profit: number
  margin_pct: number
}

export type PortalSnapshot = {
  application: ApplicationDetailRow
  documents: ApplicationDocumentRow[]
  payments: PaymentRow[]
  contracts: ContractRow[]
}

export async function getDashboardMetrics() {
  const supabase = await createClient()

  const [leads, deals, departures, payments, tasks, funnelSummary, controllingSummary] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).in('status', ['new', 'assigned', 'in_progress', 'qualified']),
    supabase.from('deals').select('*', { count: 'exact', head: true }).in('stage', ['qualified', 'proposal', 'negotiation', 'won']),
    supabase.from('departures').select('*', { count: 'exact', head: true }).in('status', ['published', 'selling']),
    supabase.from('payments').select('*', { count: 'exact', head: true }).in('status', ['due', 'partial', 'pending']),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).in('status', ['todo', 'doing']),
    supabase.from('reporting_funnel_summary').select('*').maybeSingle(),
    supabase.from('reporting_controlling_summary').select('*').maybeSingle(),
  ])

  return {
    openLeads: leads.count ?? 0,
    activeDeals: deals.count ?? 0,
    upcomingDepartures: departures.count ?? 0,
    duePayments: payments.count ?? 0,
    openTasks: tasks.count ?? 0,
    activeApplications: Number(funnelSummary.data?.active_applications ?? 0),
    queuedMessages: Number(funnelSummary.data?.queued_messages ?? 0),
    partnerLiabilities: Number(funnelSummary.data?.partner_liabilities ?? 0),
    paidRevenue: Number(funnelSummary.data?.paid_revenue ?? 0),
    grossProfit: Number(controllingSummary.data?.gross_profit ?? 0),
    netProfit: Number(controllingSummary.data?.net_profit ?? 0),
  }
}

export async function getRecentLeads(limit = 10): Promise<LeadRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select(`id, owner_user_id, desired_program_id, desired_departure_id, converted_deal_id, partner_account_id, ownership_lock_status, ownership_locked_until, ownership_note, source_channel, source_detail,
      contact_name_raw, phone_raw, email_raw, desired_country, status, score, message, metadata,
      assigned_at, qualified_at, next_action_at, disqualified_reason, created_at,
      owner:profiles(id, full_name, email),
      partner:accounts(id, display_name, account_type),
      desired_program:programs(id, title, public_slug, segment),
      desired_departure:departures(id, departure_name, start_date, status)`)
    .order('created_at', { ascending: false })
    .limit(limit)
  return asRows<LeadRow>(data).map(normalizeLeadRow)
}

export async function getUnassignedLeads(limit = 80): Promise<LeadRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select(`id, owner_user_id, desired_program_id, desired_departure_id, converted_deal_id, partner_account_id, ownership_lock_status, ownership_locked_until, ownership_note, source_channel, source_detail,
      contact_name_raw, phone_raw, email_raw, desired_country, status, score, message, metadata,
      assigned_at, qualified_at, next_action_at, disqualified_reason, created_at,
      owner:profiles(id, full_name, email),
      partner:accounts(id, display_name, account_type),
      desired_program:programs(id, title, public_slug, segment),
      desired_departure:departures(id, departure_name, start_date, status)`)
    .is('owner_user_id', null)
    .is('converted_deal_id', null)
    .in('status', ['new', 'assigned', 'in_progress', 'qualified'])
    .order('created_at', { ascending: false })
    .limit(limit)
  return asRows<LeadRow>(data).map(normalizeLeadRow)
}

export async function getDealFlowSummaries(dealIds: string[]): Promise<Record<string, DealFlowSummary>> {
  const uniqueDealIds = [...new Set(dealIds.filter(Boolean))]
  if (!uniqueDealIds.length) return {}

  const supabase = hasServiceRole() ? createAdminClient() : await createClient()
  const [contractsRes, paymentsRes, applicationsRes] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, deal_id, status, signed_at, created_at')
      .in('deal_id', uniqueDealIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('id, deal_id, amount, status, metadata, created_at')
      .in('deal_id', uniqueDealIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('applications')
      .select('id, deal_id, created_at')
      .in('deal_id', uniqueDealIds)
      .order('created_at', { ascending: false }),
  ])

  const result: Record<string, DealFlowSummary> = {}
  for (const id of uniqueDealIds) {
    result[id] = {
      deal_id: id,
      contract_id: null,
      contract_status: null,
      contract_signed_at: null,
      payment_id: null,
      payment_status: null,
      payment_amount: 0,
      payment_paid_amount: 0,
      application_id: null,
    }
  }

  for (const contract of asRows<{ id: string; deal_id: string | null; status: string | null; signed_at: string | null }>(contractsRes.data)) {
    if (!contract.deal_id || result[contract.deal_id]?.contract_id) continue
    result[contract.deal_id].contract_id = contract.id
    result[contract.deal_id].contract_status = contract.status
    result[contract.deal_id].contract_signed_at = contract.signed_at
  }

  for (const payment of asRows<{ id: string; deal_id: string | null; amount: number | null; status: string | null; metadata?: JsonMap }>(paymentsRes.data)) {
    if (!payment.deal_id) continue
    const summary = result[payment.deal_id]
    if (!summary) continue
    if (!summary.payment_id) {
      summary.payment_id = payment.id
      summary.payment_status = payment.status
    }
    summary.payment_amount += Number(payment.amount ?? 0)
    summary.payment_paid_amount += Number(payment.metadata?.paid_amount ?? (payment.status === 'paid' ? payment.amount : 0) ?? 0)
  }

  for (const application of asRows<{ id: string; deal_id: string | null }>(applicationsRes.data)) {
    if (!application.deal_id || result[application.deal_id]?.application_id) continue
    result[application.deal_id].application_id = application.id
  }

  return result
}

export async function getMyLeads(ownerUserId: string, limit = 80): Promise<LeadRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select(`id, owner_user_id, desired_program_id, desired_departure_id, converted_deal_id, partner_account_id, ownership_lock_status, ownership_locked_until, ownership_note, source_channel, source_detail,
      contact_name_raw, phone_raw, email_raw, desired_country, status, score, message, metadata,
      assigned_at, qualified_at, next_action_at, disqualified_reason, created_at,
      owner:profiles(id, full_name, email),
      partner:accounts(id, display_name, account_type),
      desired_program:programs(id, title, public_slug, segment),
      desired_departure:departures(id, departure_name, start_date, status)`)
    .eq('owner_user_id', ownerUserId)
    .is('converted_deal_id', null)
    .order('assigned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  return asRows<LeadRow>(data).map(normalizeLeadRow)
}

export async function getLeadById(id: string): Promise<LeadRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select(`id, owner_user_id, desired_program_id, desired_departure_id, converted_deal_id, partner_account_id, ownership_lock_status, ownership_locked_until, ownership_note, source_channel, source_detail,
      contact_name_raw, phone_raw, email_raw, desired_country, status, score, message, metadata,
      assigned_at, qualified_at, next_action_at, disqualified_reason, created_at,
      owner:profiles(id, full_name, email),
      partner:accounts(id, display_name, account_type),
      desired_program:programs(id, title, public_slug, segment),
      desired_departure:departures(id, departure_name, start_date, status)`)
    .eq('id', id)
    .maybeSingle()
  return asRow<LeadRow>(data) ? normalizeLeadRow(asRow<LeadRow>(data) as LeadRow) : null
}

async function selectDealsRows(supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>, limit?: number, id?: string) {
  const fullSelect = `id, owner_user_id, lead_id, account_id, program_id, departure_id, partner_account_id, ownership_lock_status, ownership_locked_until, ownership_note, title, stage, estimated_value, currency,
      participants_count, close_date, notes, created_at,
      owner:profiles(id, full_name, email),
      lead:leads!deals_lead_id_fkey(id, contact_name_raw, phone_raw, email_raw, desired_country, source_channel, message,
        desired_program:programs(id, title, public_slug, segment),
        desired_departure:departures(id, departure_name, start_date, status)
      ),
      account:accounts!deals_account_id_fkey(id, display_name, account_type),
      partner:accounts!deals_partner_account_id_fkey(id, display_name, account_type),
      program:programs(id, title, public_slug, segment),
      departure:departures(id, departure_name, start_date, status)`

  const compactSelect = `id, owner_user_id, lead_id, account_id, program_id, departure_id, title, stage, estimated_value, currency, participants_count, close_date, notes, created_at,
      lead:leads!deals_lead_id_fkey(id, contact_name_raw, phone_raw, email_raw, desired_country, source_channel, message,
        desired_program:programs(id, title, public_slug, segment),
        desired_departure:departures(id, departure_name, start_date, status)
      ),
      account:accounts!deals_account_id_fkey(id, display_name, account_type),
      program:programs(id, title, public_slug, segment),
      departure:departures(id, departure_name, start_date, status)`

  const minimalSelect = 'id, title, stage, estimated_value, currency, participants_count, close_date, notes, created_at'

  for (const select of [fullSelect, compactSelect, minimalSelect]) {
    let query = supabase.from('deals').select(select)
    if (id) query = query.eq('id', id)
    if (!id && typeof limit === 'number') query = query.order('created_at', { ascending: false }).limit(limit)
    const result = id ? await query.maybeSingle() : await query
    if (!result.error) {
      return Array.isArray(result.data) ? result.data : result.data ? [result.data] : []
    }
  }

  return []
}

export async function getDeals(limit = 20): Promise<DealRow[]> {
  const supabase = hasServiceRole() ? createAdminClient() : await createClient()
  const rows = await selectDealsRows(supabase, limit)
  const deals = asRows<DealRow>(rows).map(normalizeDealRow)
  if (!deals.length) return deals

  const { data: linkedApplications } = await supabase
    .from('applications')
    .select('deal_id')
    .in('deal_id', deals.map((deal) => deal.id))

  const transferredDealIds = new Set(
    asRows<{ deal_id: string | null }>(linkedApplications)
      .map((row) => row.deal_id)
      .filter((value): value is string => Boolean(value)),
  )

  return deals.filter((deal) => !transferredDealIds.has(deal.id))
}

export async function getDealById(id: string): Promise<DealRow | null> {
  const supabase = hasServiceRole() ? createAdminClient() : await createClient()
  const rows = await selectDealsRows(supabase, undefined, id)
  return asRow<DealRow>(rows[0]) ? normalizeDealRow(asRow<DealRow>(rows[0]) as DealRow) : null
}

export async function getAccounts(limit = 20): Promise<AccountRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('accounts').select('id, display_name, account_type, city, country, status, created_at').order('created_at', { ascending: false }).limit(limit)
  return asRows<AccountRow>(data)
}

export async function getPartnerAccounts(limit = 50): Promise<AccountRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('accounts')
    .select('id, display_name, account_type, city, country, status, created_at')
    .eq('account_type', 'partner')
    .order('display_name', { ascending: true })
    .limit(limit)
  return asRows<AccountRow>(data)
}

export async function getPrograms(limit = 50): Promise<ProgramRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('programs').select('id, code, title, country, city, segment, trip_type, language, duration_days, short_description, description, public_slug, is_active').order('created_at', { ascending: false }).limit(limit)
  return asRows<ProgramRow>(data)
}

export async function getPublicPrograms(limit = 50): Promise<ProgramRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('programs').select('id, title, country, city, segment, trip_type, language, duration_days, short_description, public_slug').eq('is_active', true).order('created_at', { ascending: false }).limit(limit)
  return asRows<ProgramRow>(data)
}

export async function getProgramBySlug(slug: string): Promise<ProgramRow | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('programs').select('*').eq('public_slug', slug).eq('is_active', true).maybeSingle()
  return asRow<ProgramRow>(data)
}

export async function getDepartureById(id: string): Promise<DepartureDetailRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('departures')
    .select(`id, departure_name, city, start_date, end_date, application_deadline, seat_capacity, status, base_price, currency, program_id,
      program:programs(id, title, country, city, segment, public_slug)`)
    .eq('id', id)
    .maybeSingle()

  const departure = asRow<DepartureDetailRow & { program?: DepartureDetailRow['program'] | DepartureDetailRow['program'][] }>(data)
  if (!departure) return null

  return {
    ...departure,
    program: firstRelation(departure.program),
  }
}

export async function getDepartures(limit = 50): Promise<DepartureRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('departures').select('id, departure_name, city, start_date, end_date, application_deadline, seat_capacity, status, base_price, currency, program_id').order('start_date', { ascending: true }).limit(limit)
  return asRows<DepartureRow>(data)
}

export async function getProgramDepartures(programId: string): Promise<DepartureRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('departures').select('id, departure_name, start_date, end_date, application_deadline, seat_capacity, status, base_price, currency').eq('program_id', programId).in('status', ['published', 'selling']).order('start_date', { ascending: true })
  return asRows<DepartureRow>(data)
}


export type ApplicationsReadDebug = {
  source: 'user-full' | 'user-minimal' | 'admin-full' | 'admin-minimal' | 'direct-created-id' | 'failed'
  error: string | null
  attempts: string[]
}

async function selectApplicationsRowsWithDebug(
  options: { limit?: number; dealId?: string; departureId?: string; createdId?: string | null } = {},
): Promise<{ rows: ApplicationRow[]; debug: ApplicationsReadDebug }> {
  const fullSelect = `id, deal_id, departure_id, participant_name, guardian_name, guardian_phone, guardian_email, status, visa_status, contract_status,
      documents_ready, amount_total, amount_paid, payment_status, created_at,
      deal:deals(id, title, stage),
      departure:departures(id, departure_name, start_date, status)`
  const minimalSelect = 'id, deal_id, departure_id, participant_name, guardian_name, guardian_phone, guardian_email, status, visa_status, contract_status, documents_ready, amount_total, amount_paid, payment_status, created_at'

  const attempts: string[] = []

  async function trySelect(
    label: ApplicationsReadDebug['source'],
    supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
    select: string,
  ) {
    let query = supabase.from('applications').select(select)
    if (options.dealId) query = query.eq('deal_id', options.dealId)
    if (options.departureId) query = query.eq('departure_id', options.departureId)
    if (options.createdId) query = query.eq('id', options.createdId)
    if (typeof options.limit === 'number') query = query.order('created_at', { ascending: false }).limit(options.limit)
    const result = await query
    if (result.error) {
      attempts.push(`${label}: ${result.error.message}`)
      return null
    }
    return { rows: asRows<ApplicationRow>(result.data).map(normalizeApplicationRow), source: label }
  }

  const userClient = await createClient()
  const userFull = await trySelect('user-full', userClient, fullSelect)
  if (userFull) return { rows: userFull.rows, debug: { source: userFull.source, error: null, attempts } }

  const userMinimal = await trySelect('user-minimal', userClient, minimalSelect)
  if (userMinimal) return { rows: userMinimal.rows, debug: { source: userMinimal.source, error: null, attempts } }

  if (hasServiceRole()) {
    const adminClient = createAdminClient()
    const adminFull = await trySelect('admin-full', adminClient, fullSelect)
    if (adminFull) return { rows: adminFull.rows, debug: { source: adminFull.source, error: null, attempts } }

    const adminMinimal = await trySelect('admin-minimal', adminClient, minimalSelect)
    if (adminMinimal) return { rows: adminMinimal.rows, debug: { source: adminMinimal.source, error: null, attempts } }
  }

  return {
    rows: [],
    debug: {
      source: 'failed',
      error: attempts.at(-1) ?? 'Не удалось прочитать applications',
      attempts,
    },
  }
}

export async function getApplicationsByDeal(dealId: string, limit = 50): Promise<ApplicationRow[]> {
  const result = await selectApplicationsRowsWithDebug({ dealId, limit })
  return result.rows
}

export async function getApplicationsByDeparture(departureId: string, limit = 50): Promise<ApplicationRow[]> {
  const result = await selectApplicationsRowsWithDebug({ departureId, limit })
  return result.rows
}

export async function getApplications(limit = 20): Promise<ApplicationRow[]> {
  const result = await selectApplicationsRowsWithDebug({ limit })
  return result.rows
}

export async function getApplicationsReadDebug(options: { dealId?: string | null; departureId?: string | null; createdId?: string | null; limit?: number } = {}) {
  return selectApplicationsRowsWithDebug({
    dealId: options.dealId ?? undefined,
    departureId: options.departureId ?? undefined,
    createdId: options.createdId ?? undefined,
    limit: options.limit,
  })
}

export async function getApplicationById(id: string): Promise<ApplicationDetailRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('applications')
    .select(`id, deal_id, departure_id, participant_name, participant_birth_date, guardian_name, guardian_phone, guardian_email,
      status, documents_ready, documents_completion_pct, visa_status, amount_total, amount_paid, notes,
      portal_access_token, portal_access_enabled, portal_auth_mode, portal_access_expires_at, portal_last_opened_at, current_contract_id, created_at,
      deal:deals(id, title, stage, currency, account_id,
        account:accounts!deals_account_id_fkey(id, display_name, account_type),
        program:programs(id, title, public_slug, segment),
        departure:departures(id, departure_name, start_date, status)
      ),
      departure:departures(id, departure_name, start_date, end_date, city, status, currency,
        program:programs(id, title, country, city, segment, public_slug)
      )`)
    .eq('id', id)
    .maybeSingle()
  return asRow<ApplicationDetailRow>(data) ? normalizeApplicationDetailRow(asRow<ApplicationDetailRow>(data) as ApplicationDetailRow) : null
}

export async function getPayments(limit = 20): Promise<PaymentRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('payments').select(`id, deal_id, application_id, payer_name, label, amount, currency, due_date, status, paid_at, created_at, metadata,
      application:applications(id, participant_name),
      deal:deals(id, title)`).order('created_at', { ascending: false }).limit(limit)
  return asRows<PaymentRow>(data).map(normalizePaymentRow)
}

export async function getPaymentsByDeal(dealId: string, limit = 20): Promise<PaymentRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('payments').select(`id, deal_id, application_id, payer_name, label, amount, currency, due_date, status, paid_at, created_at, metadata,
      application:applications(id, participant_name),
      deal:deals(id, title)`).eq('deal_id', dealId).order('created_at', { ascending: false }).limit(limit)
  return asRows<PaymentRow>(data).map(normalizePaymentRow)
}

export async function getPaymentsByApplication(applicationId: string, limit = 20): Promise<PaymentRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('payments').select(`id, deal_id, application_id, payer_name, label, amount, currency, due_date, status, paid_at, created_at, metadata,
      application:applications(id, participant_name),
      deal:deals(id, title)`).eq('application_id', applicationId).order('created_at', { ascending: false }).limit(limit)
  return asRows<PaymentRow>(data).map(normalizePaymentRow)
}

export async function getSalesScripts(limit = 20): Promise<SalesScriptRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('sales_scripts').select('id, segment, stage, title, body, created_at').order('created_at', { ascending: false }).limit(limit)
  return asRows<SalesScriptRow>(data)
}

export async function getSalesScriptsBySegment(segment: string, limit = 20): Promise<SalesScriptRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('sales_scripts').select('id, segment, stage, title, body, created_at').eq('segment', segment).order('created_at', { ascending: false }).limit(limit)
  return asRows<SalesScriptRow>(data)
}

export async function getTasks(limit = 20): Promise<TaskRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('tasks').select(`id, owner_user_id, lead_id, deal_id, application_id, title, description, status, due_date, priority, created_at,
      lead:leads(id, contact_name_raw, phone_raw, email_raw),
      deal:deals(id, title, stage),
      application:applications(id, participant_name)`).order('created_at', { ascending: false }).limit(limit)
  return asRows<TaskRow>(data)
}

export async function getTasksForOwner(ownerUserId: string, limit = 100): Promise<TaskRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tasks')
    .select(`id, owner_user_id, lead_id, deal_id, application_id, title, description, status, due_date, priority, created_at,
      lead:leads(id, contact_name_raw, phone_raw, email_raw),
      deal:deals(id, title, stage),
      application:applications(id, participant_name)`)
    .or(`owner_user_id.eq.${ownerUserId},owner_user_id.is.null`)
    .in('status', ['todo', 'doing'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  return asRows<TaskRow>(data)
}

export async function getTasksByLead(leadId: string, limit = 20): Promise<TaskRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tasks')
    .select('id, owner_user_id, lead_id, deal_id, application_id, title, description, status, due_date, priority, created_at')
    .eq('lead_id', leadId)
    .in('status', ['todo', 'doing'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  return asRows<TaskRow>(data)
}

export async function getTasksByDeal(dealId: string, limit = 20): Promise<TaskRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tasks')
    .select('id, owner_user_id, lead_id, deal_id, application_id, title, description, status, due_date, priority, created_at')
    .eq('deal_id', dealId)
    .in('status', ['todo', 'doing'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  return asRows<TaskRow>(data)
}



export async function getControllingSummary(): Promise<ControllingSummaryRow> {
  const supabase = await createClient()
  const { data } = await supabase.from('reporting_controlling_summary').select('*').maybeSingle()

  return {
    paid_revenue: Number(data?.paid_revenue ?? 0),
    cogs_total: Number(data?.cogs_total ?? 0),
    operating_expenses_total: Number(data?.operating_expenses_total ?? 0),
    fixed_expenses_total: Number(data?.fixed_expenses_total ?? 0),
    variable_expenses_total: Number(data?.variable_expenses_total ?? 0),
    gross_profit: Number(data?.gross_profit ?? 0),
    net_profit: Number(data?.net_profit ?? 0),
  }
}

export async function getControllingExpenses(limit = 50): Promise<ControllingExpenseRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('controlling_expenses')
    .select(`id, departure_id, title, category, expense_kind, expense_nature, scope_type, amount, currency, recognized_on, status, notes, created_at,
      created_by:profiles(id, full_name, email),
      departure:departures(id, departure_name, start_date, program:programs(id, title))`)
    .order('recognized_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  return asRows<ControllingExpenseRow>(data).map((expense) => {
    const departure = Array.isArray(expense.departure) ? (expense.departure[0] ?? null) : (expense.departure ?? null)
    const normalizedDeparture = departure
      ? {
          ...departure,
          program: Array.isArray(departure.program) ? (departure.program[0] ?? null) : (departure.program ?? null),
        }
      : null

    return {
      ...expense,
      created_by: Array.isArray(expense.created_by) ? (expense.created_by[0] ?? null) : (expense.created_by ?? null),
      departure: normalizedDeparture,
    }
  })
}

export async function getControllingExpensesByDeparture(departureId: string, limit = 50): Promise<ControllingExpenseRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('controlling_expenses')
    .select(`id, departure_id, title, category, expense_kind, expense_nature, scope_type, amount, currency, recognized_on, status, notes, created_at,
      created_by:profiles(id, full_name, email),
      departure:departures(id, departure_name, start_date, program:programs(id, title))`)
    .eq('departure_id', departureId)
    .order('recognized_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  return asRows<ControllingExpenseRow>(data).map((expense) => {
    const departure = Array.isArray(expense.departure) ? (expense.departure[0] ?? null) : (expense.departure ?? null)
    const normalizedDeparture = departure
      ? {
          ...departure,
          program: Array.isArray(departure.program) ? (departure.program[0] ?? null) : (departure.program ?? null),
        }
      : null

    return {
      ...expense,
      created_by: Array.isArray(expense.created_by) ? (expense.created_by[0] ?? null) : (expense.created_by ?? null),
      departure: normalizedDeparture,
    }
  })
}

export async function getDepartureProfitability(limit = 50): Promise<DepartureProfitabilityRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('reporting_departure_profitability')
    .select('*')
    .order('start_date', { ascending: true })
    .limit(limit)

  return asRows<DepartureProfitabilityRow>(data).map((row) => ({
    ...row,
    applications_count: Number(row.applications_count ?? 0),
    paid_revenue: Number(row.paid_revenue ?? 0),
    cogs_total: Number(row.cogs_total ?? 0),
    gross_profit: Number(row.gross_profit ?? 0),
    margin_pct: Number(row.margin_pct ?? 0),
  }))
}

export async function getActivityLog(entityType: string, entityId: string, limit = 20): Promise<ActivityRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('activity_log').select('id, entity_type, entity_id, event_type, title, body, metadata, created_at, actor:profiles(id, full_name, email)').eq('entity_type', entityType).eq('entity_id', entityId).order('created_at', { ascending: false }).limit(limit)
  return asRows<ActivityRow>(data)
}

export async function getApplicationDocuments(applicationId: string, limit = 50): Promise<ApplicationDocumentRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('application_documents').select(`id, application_id, code, title, status, due_date, file_path, reviewed_at, rejected_reason, notes, sort_order, created_at,
      reviewed_by:profiles(id, full_name, email)`).eq('application_id', applicationId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }).limit(limit)
  return asRows<ApplicationDocumentRow>(data).map((doc) => ({
    ...doc,
    reviewed_by: Array.isArray(doc.reviewed_by) ? (doc.reviewed_by[0] ?? null) : (doc.reviewed_by ?? null),
  }))
}

export async function getContractTemplates(limit = 20): Promise<ContractTemplateRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contract_templates').select('id, code, title, segment, locale, is_active, created_at').eq('is_active', true).order('created_at', { ascending: false }).limit(limit)
  return asRows<ContractTemplateRow>(data)
}

export async function getContracts(limit = 40): Promise<ContractRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contracts').select(`id, application_id, deal_id, account_id, contract_template_id, contract_number, title, status, locale, payload, rendered_text,
      sent_at, viewed_at, signed_at, signatory_name, signatory_email, notes, created_at,
      application:applications(id, participant_name, guardian_name, guardian_email),
      deal:deals(id, title),
      account:accounts!deals_account_id_fkey(id, display_name, account_type),
      template:contract_templates(id, code, title)`).order('created_at', { ascending: false }).limit(limit)
  return asRows<ContractRow>(data).map(normalizeContractRow)
}

export async function getContractsByApplication(applicationId: string, limit = 20): Promise<ContractRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contracts').select(`id, application_id, deal_id, account_id, contract_template_id, contract_number, title, status, locale, payload, rendered_text,
      sent_at, viewed_at, signed_at, signatory_name, signatory_email, notes, created_at,
      application:applications(id, participant_name, guardian_name, guardian_email),
      deal:deals(id, title),
      account:accounts!deals_account_id_fkey(id, display_name, account_type),
      template:contract_templates(id, code, title)`).eq('application_id', applicationId).order('created_at', { ascending: false }).limit(limit)
  return asRows<ContractRow>(data).map(normalizeContractRow)
}

export async function getContractsByDeal(dealId: string, limit = 20): Promise<ContractRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('contracts').select(`id, application_id, deal_id, account_id, contract_template_id, contract_number, title, status, locale, payload, rendered_text,
      sent_at, viewed_at, signed_at, signatory_name, signatory_email, notes, created_at,
      application:applications(id, participant_name, guardian_name, guardian_email),
      deal:deals(id, title),
      account:accounts!deals_account_id_fkey(id, display_name, account_type),
      template:contract_templates(id, code, title)`).eq('deal_id', dealId).order('created_at', { ascending: false }).limit(limit)
  return asRows<ContractRow>(data).map(normalizeContractRow)
}

export async function getContractById(id: string): Promise<ContractRow | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('contracts').select(`id, application_id, deal_id, account_id, contract_template_id, contract_number, title, status, locale, payload, rendered_text,
      sent_at, viewed_at, signed_at, signatory_name, signatory_email, notes, created_at,
      application:applications(id, participant_name, guardian_name, guardian_email),
      deal:deals(id, title),
      account:accounts!deals_account_id_fkey(id, display_name, account_type),
      template:contract_templates(id, code, title)`).eq('id', id).maybeSingle()
  return asRow<ContractRow>(data) ? normalizeContractRow(asRow<ContractRow>(data) as ContractRow) : null
}

function isPortalApplicationActive(application: ApplicationDetailRow | null | undefined) {
  if (!application || !application.portal_access_enabled) return false
  if (!application.portal_access_expires_at) return true
  const expiresAt = new Date(application.portal_access_expires_at)
  if (Number.isNaN(expiresAt.getTime())) return true
  return expiresAt.getTime() > Date.now()
}

export async function getPortalSnapshotByToken(token: string): Promise<PortalSnapshot | null> {
  if (!hasServiceRole()) return null
  const admin = createAdminClient()
  const { data: application } = await admin
    .from('applications')
    .select(`id, deal_id, departure_id, participant_name, participant_birth_date, guardian_name, guardian_phone, guardian_email,
      status, documents_ready, documents_completion_pct, visa_status, amount_total, amount_paid, notes,
      portal_access_token, portal_access_enabled, portal_auth_mode, portal_access_expires_at, portal_last_opened_at, current_contract_id, created_at,
      deal:deals(id, title, stage, currency, account_id,
        account:accounts!deals_account_id_fkey(id, display_name, account_type),
        program:programs(id, title, public_slug, segment),
        departure:departures(id, departure_name, start_date, status)
      ),
      departure:departures(id, departure_name, start_date, end_date, city, status, currency,
        program:programs(id, title, country, city, segment, public_slug)
      )`)
    .eq('portal_access_token', token)
    .maybeSingle()
  const typedApplication = asRow<ApplicationDetailRow>(application) ? normalizeApplicationDetailRow(asRow<ApplicationDetailRow>(application) as ApplicationDetailRow) : null
  if (!typedApplication || !isPortalApplicationActive(typedApplication)) return null
  const applicationId = typedApplication.id
  const [documentsRes, paymentsRes, contractsRes] = await Promise.all([
    admin.from('application_documents').select(`id, application_id, code, title, status, due_date, file_path, reviewed_at, rejected_reason, notes, sort_order, created_at,
        reviewed_by:profiles(id, full_name, email)`).eq('application_id', applicationId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    admin.from('payments').select(`id, deal_id, application_id, payer_name, label, amount, currency, due_date, status, paid_at, created_at,
        application:applications(id, participant_name),
        deal:deals(id, title)`).eq('application_id', applicationId).order('created_at', { ascending: false }),
    admin.from('contracts').select(`id, application_id, deal_id, account_id, contract_template_id, contract_number, title, status, locale, payload, rendered_text,
        sent_at, viewed_at, signed_at, signatory_name, signatory_email, notes, created_at,
        application:applications(id, participant_name, guardian_name, guardian_email),
        deal:deals(id, title),
        account:accounts!deals_account_id_fkey(id, display_name, account_type),
        template:contract_templates(id, code, title)`).eq('application_id', applicationId).order('created_at', { ascending: false }),
  ])
  const documents = asRows<ApplicationDocumentRow>(documentsRes.data).map((doc) => ({
    ...doc,
    reviewed_by: Array.isArray(doc.reviewed_by) ? (doc.reviewed_by[0] ?? null) : (doc.reviewed_by ?? null),
  }))

  return {
    application: typedApplication,
    documents,
    payments: asRows<PaymentRow>(paymentsRes.data).map(normalizePaymentRow),
    contracts: asRows<ContractRow>(contractsRes.data).map(normalizeContractRow),
  }
}

export async function getPortalContractByToken(token: string, contractId: string): Promise<ContractRow | null> {
  const snapshot = await getPortalSnapshotByToken(token)
  if (!snapshot) return null
  return snapshot.contracts.find((contract) => contract.id === contractId) ?? null
}

export async function getAssignableManagers(limit = 50): Promise<ManagerOption[]> {
  const supabase = hasServiceRole() ? createAdminClient() : await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  return asRows<ManagerOption>(data)
}
