import { getSiteUrl } from '@/lib/env'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { label, partnerCodeStatusOptions } from '@/lib/labels'
import { createClient } from '@/lib/supabase/server'
import {
  bindLeadToPartnerAction,
  createPartnerCodeAction,
  releasePartnerLockAction,
} from './actions'

export default async function PartnersPage() {
  const supabase = await createClient()

  const [partnersRes, codesRes, partnerLeadsRes, accountsRes] = await Promise.all([
    supabase.from('reporting_partner_performance').select('*').order('partner_name', { ascending: true }),
    supabase
      .from('partner_referral_codes')
      .select('id, code, label, status, lock_days, commission_pct, landing_path, created_at, partner:accounts(display_name)')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('leads')
      .select('id, contact_name_raw, phone_raw, email_raw, source_channel, source_detail, ownership_lock_status, ownership_locked_until, ownership_note, created_at, partner:accounts(display_name), deal:deals(id, title)')
      .not('partner_account_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('accounts')
      .select('id, display_name, account_type')
      .in('account_type', ['partner', 'school'])
      .order('display_name', { ascending: true }),
  ])

  const siteUrl = getSiteUrl()
  const partners = partnersRes.data ?? []
  const codes = codesRes.data ?? []
  const partnerLeads = partnerLeadsRes.data ?? []
  const partnerAccounts = accountsRes.data ?? []

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Партнёрский контур</h1>
          <p className="muted">Здесь живёт защитная логика партнёрского канала: код источника, закрепление клиента, результативность и правила взаимодействия с внешними школами и посредниками.</p>
        </div>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Создать партнёрский код</h2>
          <form action={createPartnerCodeAction}>
            <div className="form-grid">
              <label>
                Партнёрский аккаунт
                <select name="partner_account_id" required defaultValue="">
                  <option value="" disabled>
                    Выберите партнёра
                  </option>
                  {partnerAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.display_name} · {label('accountType', account.account_type)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Код
                <input name="code" placeholder="school-penza-2026" required />
              </label>
              <label>
                Метка
                <input name="label" placeholder="Лицей Пензы / сезон 2026" required />
              </label>
              <label>
                Путь лендинга
                <input name="landing_path" defaultValue="/programs" />
              </label>
              <label>
                Дней защиты
                <input name="lock_days" type="number" min="1" defaultValue="180" />
              </label>
              <label>
                Комиссия %
                <input name="commission_pct" type="number" min="0" max="100" step="0.01" placeholder="12.5" />
              </label>
            </div>
            <label>
              Статус
              <select name="status" defaultValue="active">
                {partnerCodeStatusOptions.map((status) => (
                  <option key={status} value={status}>{label('partnerCodeStatus', status)}</option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button className="button">Создать код</button>
            </div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Привязать лид к партнёру</h2>
          <form action={bindLeadToPartnerAction}>
            <div className="form-grid">
              <label>
                ID лида
                <input name="lead_id" placeholder="uuid лида" required />
              </label>
              <label>
                Партнёрский код
                <input name="code" placeholder="lyceum-referral" required />
              </label>
            </div>
            <label>
              Комментарий
              <textarea name="note" placeholder="Почему лид должен быть отнесён к партнёрскому источнику" />
            </label>
            <div className="form-actions">
              <button className="button-secondary">Привязать</button>
            </div>
          </form>
          <div className="notice">После привязки лид и сделка получают защиту и попадают в защищённый партнёрский контур.</div>
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Результативность партнёров</h2>
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
                <th>Последний лид</th>
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
                  <td>{formatDateTime(partner.last_lead_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Коды и партнёрские ссылки</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Код</th>
                <th>Партнёр</th>
                <th>Статус</th>
                <th>Защита</th>
                <th>Комиссия</th>
                <th>Ссылка</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => {
                const landingUrl = `${siteUrl}${code.landing_path || '/programs'}?partner_code=${encodeURIComponent(code.code)}`
                return (
                  <tr key={code.id}>
                    <td>
                      <div>{code.code}</div>
                      <div className="micro">{code.label}</div>
                    </td>
                    <td>{(code.partner as { display_name?: string | null } | null)?.display_name || '—'}</td>
                    <td>{label('partnerCodeStatus', code.status)}</td>
                    <td>{code.lock_days} дней</td>
                    <td>{code.commission_pct ?? '—'}%</td>
                    <td>
                      <a href={landingUrl} target="_blank" rel="noreferrer">
                        {landingUrl}
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Лиды под защитой партнёра</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Контакт</th>
                <th>Партнёр</th>
                <th>Защита</th>
                <th>Комментарий</th>
                <th>Сделка</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {partnerLeads.map((lead) => {
                const relatedDeal = Array.isArray(lead.deal) ? lead.deal[0] : lead.deal

                return (
                  <tr key={lead.id}>
                    <td>
                      <div>{lead.contact_name_raw || 'Без имени'}</div>
                      <div className="micro">{lead.phone_raw || lead.email_raw || '—'}</div>
                      <div className="micro">{label('channel', lead.source_channel)}</div>
                    </td>
                    <td>{(lead.partner as { display_name?: string | null } | null)?.display_name || '—'}</td>
                    <td>
                      <div>{label('lockStatus', lead.ownership_lock_status)}</div>
                      <div className="micro">до {formatDateTime(lead.ownership_locked_until)}</div>
                    </td>
                    <td>{lead.ownership_note || '—'}</td>
                    <td>
                      {relatedDeal ? (
                        <a href={`/dashboard/deals/${relatedDeal.id}`}>{relatedDeal.title || 'Открыть сделку'}</a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <form action={releasePartnerLockAction}>
                        <input type="hidden" name="entity_type" value="lead" />
                        <input type="hidden" name="entity_id" value={lead.id} />
                        <input type="hidden" name="note" value="Защита снята из раздела партнёров" />
                        <button className="button-secondary">Снять защиту</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
