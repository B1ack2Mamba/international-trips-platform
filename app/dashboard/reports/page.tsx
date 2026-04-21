import { KpiCard } from '@/components/kpi-card'
import { formatCurrency, formatDate } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { getControllingSummary, getDepartureProfitability } from '@/lib/queries'

export default async function ReportsPage() {
  const supabase = await createClient()
  const [funnelRes, partnersRes, opsRes, controlling, profitability] = await Promise.all([
    supabase.from('reporting_funnel_summary').select('*').maybeSingle(),
    supabase.from('reporting_partner_performance').select('*').order('booked_amount', { ascending: false }),
    supabase.from('reporting_departure_ops').select('*').order('start_date', { ascending: true }),
    getControllingSummary(),
    getDepartureProfitability(30),
  ])

  const funnel = funnelRes.data
  const partners = partnersRes.data ?? []
  const ops = opsRes.data ?? []

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Отчёты</h1>
          <p className="muted">Здесь мозг видит не сырой шум, а сжатую картину: воронка, прибыльность, партнёры, готовность выездов и давление расходов.</p>
        </div>
      </section>

      <section className="kpi-grid">
        <KpiCard label="Активные лиды" value={String(funnel?.active_leads ?? 0)} footnote="new / assigned / in_progress / qualified" />
        <KpiCard label="Активные сделки" value={String(funnel?.active_deals ?? 0)} footnote="qualified / proposal / negotiation / won" />
        <KpiCard label="Оплаченная выручка" value={formatCurrency(Number(funnel?.paid_revenue ?? 0))} footnote="по paid платежам" />
        <KpiCard label="Себестоимость поездок" value={formatCurrency(controlling.cogs_total)} footnote="COGS по всем выездам" />
        <KpiCard label="Операционные расходы" value={formatCurrency(controlling.operating_expenses_total)} footnote="fixed + variable" />
        <KpiCard label="Чистая прибыль" value={formatCurrency(controlling.net_profit)} footnote="после расходов" />
        <KpiCard label="Партнёрские обязательства" value={String(funnel?.partner_liabilities ?? 0)} footnote="pending / approved commissions" />
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Партнёрский performance</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Партнёр</th>
                  <th>Лиды</th>
                  <th>Сделки</th>
                  <th>Заявки</th>
                  <th>Бронь</th>
                  <th>Комиссия</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.partner_account_id}>
                    <td>{partner.partner_name}</td>
                    <td>{partner.leads_count}</td>
                    <td>{partner.deals_count}</td>
                    <td>{partner.applications_count}</td>
                    <td>{formatCurrency(Number(partner.booked_amount ?? 0))}</td>
                    <td>{formatCurrency(Number(partner.commission_amount ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Operational readiness</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Выезд</th>
                  <th>Участники</th>
                  <th>Ops ready</th>
                  <th>Открытых пунктов</th>
                </tr>
              </thead>
              <tbody>
                {ops.map((departure) => (
                  <tr key={departure.departure_id}>
                    <td>
                      <div>{departure.departure_name}</div>
                      <div className="micro">{formatDate(departure.start_date)}</div>
                    </td>
                    <td>{departure.applications_count}</td>
                    <td>{departure.ops_completion_pct}%</td>
                    <td>{departure.ops_items_open}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Прибыльность выездов</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Выезд</th>
                <th>Участники</th>
                <th>Оплаченная выручка</th>
                <th>Себестоимость</th>
                <th>Валовая прибыль</th>
                <th>Маржа</th>
              </tr>
            </thead>
            <tbody>
              {profitability.map((row) => (
                <tr key={row.departure_id}>
                  <td>
                    <div>{row.departure_name}</div>
                    <div className="micro">{formatDate(row.start_date)} · {row.status || '—'}</div>
                  </td>
                  <td>{row.applications_count}</td>
                  <td>{formatCurrency(row.paid_revenue)}</td>
                  <td>{formatCurrency(row.cogs_total)}</td>
                  <td>{formatCurrency(row.gross_profit)}</td>
                  <td>{row.margin_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
