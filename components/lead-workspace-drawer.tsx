import Link from 'next/link'
import { generateLeadScriptAction, updateLeadPersonalInfoAction } from '@/app/dashboard/leads/actions'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import type { LeadAssignableProfile } from '@/lib/lead-access'
import type { ActivityRow, ContractRow, DealFlowSummary, DealRow, LeadRow, PaymentRow, SalesScriptRow, TaskRow } from '@/lib/queries'

export function LeadWorkspaceDrawer({
  lead,
  scripts,
  aiScript,
  deal,
  dealFlow,
  contracts = [],
  payments = [],
  tasks = [],
  scriptsMode = false,
  returnPath = '/dashboard/leads',
}: {
  lead: LeadRow
  scripts: SalesScriptRow[]
  aiScript?: ActivityRow | null
  deal?: DealRow | null
  dealFlow?: DealFlowSummary | null
  contracts?: ContractRow[]
  payments?: PaymentRow[]
  tasks?: TaskRow[]
  assignableProfiles: LeadAssignableProfile[]
  scriptsMode?: boolean
  returnPath?: string
}) {
  const paidAmount = dealFlow?.payment_paid_amount ?? 0
  const totalAmount = dealFlow?.payment_amount ?? 0
  const paymentProgress = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0

  return (
    <aside className="card stack deal-editor-drawer lead-scripts-drawer" id="lead-editor">
      <div className="compact-toolbar">
        <div>
          <div className="micro">ИИ-скрипт</div>
          <h2 style={{ margin: 0 }}>{lead.contact_name_raw || 'Без имени'}</h2>
          <div className="micro">Обновляется с учётом задач, пометок, комментариев и истории действий.</div>
        </div>
        <Link className="button-secondary" href={`${returnPath}?open=${encodeURIComponent(lead.id)}`}>Закрыть</Link>
      </div>

      <form action={generateLeadScriptAction} className="form-actions">
        <input type="hidden" name="lead_id" value={lead.id} />
        <button className="button">Обновить ИИ-скрипт</button>
      </form>

      <div id="lead-ai-script" className="notice lead-script-card lead-ai-script-card">
        <div style={{ fontWeight: 800 }}>{aiScript ? 'Актуальный скрипт' : 'Скрипт ещё не создан'}</div>
        <div className="micro">{aiScript ? `обновлён ${formatDateTime(aiScript.created_at)}` : 'нажмите «Обновить ИИ-скрипт»'}</div>
        <div>{aiScript?.body || 'ИИ подготовит персональный сценарий на основе карточки клиента, задач, комментариев и истории действий.'}</div>
      </div>

      <div className="lead-inline-form lead-client-summary">
        <div>
          <h3 style={{ margin: 0 }}>Карточка клиента</h3>
          <div className="micro">Связанные сделка, договор, оплата и ближайшие дела.</div>
        </div>
        <div className="lead-client-summary-grid">
          <div className="lead-client-summary-item">
            <div className="micro">Сделка</div>
            {deal ? (
              <Link href={`/dashboard/deals?open=${deal.id}#deal-editor`}>{deal.title}</Link>
            ) : (
              <span>Пока нет</span>
            )}
            <strong>{deal ? label('dealStage', deal.stage) : '—'}</strong>
          </div>
          <div className="lead-client-summary-item">
            <div className="micro">Договор</div>
            {dealFlow?.contract_id ? (
              <Link href={`/dashboard/contracts/${dealFlow.contract_id}`}>{label('contractStatus', dealFlow.contract_status || 'draft')}</Link>
            ) : (
              <span>Не создан</span>
            )}
            <strong>{dealFlow?.contract_signed_at ? `подписан ${formatDateTime(dealFlow.contract_signed_at)}` : 'ожидает'}</strong>
          </div>
          <div className="lead-client-summary-item">
            <div className="micro">Оплата</div>
            <span>{formatCurrency(paidAmount, deal?.currency || 'RUB')} / {formatCurrency(totalAmount, deal?.currency || 'RUB')}</span>
            <strong>{paymentProgress}%</strong>
          </div>
          <div className="lead-client-summary-item">
            <div className="micro">Ближайшие дела</div>
            <span>{tasks.length ? tasks[0]?.title : 'Нет открытых задач'}</span>
            <strong>{tasks[0]?.due_date ? formatDateTime(tasks[0].due_date) : '—'}</strong>
          </div>
        </div>
        <div className="lead-client-mini-list">
          {contracts.slice(0, 2).map((contract) => (
            <Link key={contract.id} href={`/dashboard/contracts/${contract.id}`} className="lead-client-mini-row">
              <span>{contract.title || contract.contract_number}</span>
              <small>{label('contractStatus', contract.status)} · {formatDateTime(contract.created_at)}</small>
            </Link>
          ))}
          {payments.slice(0, 2).map((payment) => (
            <div key={payment.id} className="lead-client-mini-row">
              <span>{payment.label}</span>
              <small>{label('paymentStatus', payment.status)} · {formatCurrency(payment.paid_amount ?? 0, payment.currency)} / {formatCurrency(payment.amount, payment.currency)}</small>
            </div>
          ))}
        </div>
      </div>

      <div id="lead-personal-info" className="lead-inline-form lead-personal-info-form">
        <div>
          <h3 style={{ margin: 0 }}>Личная информация</h3>
          <div className="micro">Эти данные используются ИИ при обновлении скрипта.</div>
        </div>
        <form action={updateLeadPersonalInfoAction} className="compact-form-grid compact-form-grid--lead-personal">
          <input type="hidden" name="lead_id" value={lead.id} />
          <label>Имя<input name="contact_name_raw" defaultValue={lead.contact_name_raw || ''} placeholder="Анна Иванова" /></label>
          <label>Телефон<input name="phone_raw" defaultValue={lead.phone_raw || ''} placeholder="+7..." /></label>
          <label>Email<input name="email_raw" type="email" defaultValue={lead.email_raw || ''} placeholder="client@example.com" /></label>
          <label>Интерес / страна<input name="desired_country" defaultValue={lead.desired_country || ''} placeholder="Великобритания, языковой лагерь" /></label>
          <label className="lead-personal-wide">Источник / контекст<input name="source_detail" defaultValue={lead.source_detail || ''} placeholder="Откуда пришёл клиент и что уже известно" /></label>
          <label className="lead-personal-wide">Личные заметки<textarea name="message" defaultValue={lead.message || ''} placeholder="Возраст, цели, бюджет, страхи, предпочтения, кто принимает решение" /></label>
          <div className="form-actions"><button className="button-secondary">Сохранить информацию</button></div>
        </form>
      </div>

      {scriptsMode && scripts.length ? (
        <div className="stack">
          <h3 style={{ margin: 0 }}>Базовые скрипты сегмента</h3>
          {scripts.map((script) => (
            <div key={script.id} className="notice lead-script-card">
              <div style={{ fontWeight: 800 }}>{script.title}</div>
              <div className="micro">{script.stage}</div>
              <div>{script.body}</div>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
