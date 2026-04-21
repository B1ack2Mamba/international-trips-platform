import { redirect } from 'next/navigation'
import { KpiCard } from '@/components/kpi-card'
import { requirePartner } from '@/lib/auth'
import { getSiteUrl } from '@/lib/env'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'

export const dynamic = 'force-dynamic'

export default async function PartnerPage() {
  const { supabase, profile } = await requirePartner()
  const partnerAccountId = profile?.partner_account_id
  if (!partnerAccountId) redirect('/unauthorized')

  const [codesRes, leadsRes, commissionsRes, accountRes] = await Promise.all([
    supabase
      .from('partner_referral_codes')
      .select('id, code, label, status, lock_days, commission_pct, landing_path')
      .eq('partner_account_id', partnerAccountId)
      .order('created_at', { ascending: false }),
    supabase
      .from('leads')
      .select('id, contact_name_raw, phone_raw, desired_country, status, created_at, source_detail')
      .eq('partner_account_id', partnerAccountId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('partner_commissions')
      .select('id, status, base_amount, commission_amount, currency, created_at')
      .eq('partner_account_id', partnerAccountId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('accounts').select('display_name').eq('id', partnerAccountId).maybeSingle(),
  ])

  const siteUrl = getSiteUrl()
  const codes = codesRes.data ?? []
  const leads = leadsRes.data ?? []
  const commissions = commissionsRes.data ?? []
  const account = accountRes.data
  const totalBooked = commissions.reduce((sum, row) => sum + Number(row.base_amount ?? 0), 0)
  const totalCommission = commissions.reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0)

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">{account?.display_name || 'Партнёр'}</h1>
          <p className="muted">
            Здесь партнёр видит свои ссылки, лиды и расчёт по своей части воронки — без доступа к
            внутренней кухне CRM.
          </p>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Кодов" value={String(codes.length)} footnote="активные и архивные" />
        <KpiCard label="Лидов" value={String(leads.length)} footnote="последние 30" />
        <KpiCard label="Бронь" value={formatCurrency(totalBooked)} footnote="по связанным комиссиям" />
        <KpiCard label="Комиссия" value={formatCurrency(totalCommission)} footnote="ожидает / подтверждена / выплачена" />
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Партнёрские ссылки</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Код</th>
                  <th>Ссылка</th>
                  <th>Защита</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id}>
                    <td>
                      <div>{code.code}</div>
                      <div className="micro">{code.label}</div>
                      <div className="micro">{label('partnerCodeStatus', code.status)}</div>
                    </td>
                    <td>
                      <a
                        href={`${siteUrl}${code.landing_path || '/programs'}?partner_code=${encodeURIComponent(code.code)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Открыть ссылку
                      </a>
                    </td>
                    <td>{code.lock_days} дней</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Комиссии</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Статус</th>
                  <th>База</th>
                  <th>Комиссия</th>
                  <th>Когда</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((row) => (
                  <tr key={row.id}>
                    <td>{label('commissionStatus', row.status)}</td>
                    <td>{formatCurrency(Number(row.base_amount ?? 0), row.currency)}</td>
                    <td>{formatCurrency(Number(row.commission_amount ?? 0), row.currency)}</td>
                    <td>{formatDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Последние лиды</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Контакт</th>
                <th>Страна</th>
                <th>Статус</th>
                <th>Код / источник</th>
                <th>Когда</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div>{lead.contact_name_raw || 'Без имени'}</div>
                    <div className="micro">{lead.phone_raw || '—'}</div>
                  </td>
                  <td>{lead.desired_country || '—'}</td>
                  <td>{label('leadStatus', lead.status)}</td>
                  <td>{lead.source_detail || '—'}</td>
                  <td>{formatDateTime(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
